"use client";

import { DB_VERSION, getMeta, setMeta } from "./db";
import { openDB, type IDBPDatabase } from "idb";
import { databaseName } from "./demo";
import { supabase } from "./supabase";

/** Lokalt lagringsnamn ↔ `kind` i databasen på servern. */
const KINDS = {
  gyms: "gym",
  machines: "machine",
  sessions: "session",
  sets: "set",
  profile: "profile",
  plans: "plan",
  supplements: "supplement",
} as const;

type StoreName = keyof typeof KINDS;
const STORES = Object.keys(KINDS) as StoreName[];

interface RemoteRow {
  kind: string;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
}

/** Öppnar samma databas som db.ts. Namn och version måste hållas i takt. */
function raw(): Promise<IDBPDatabase> {
  return openDB(databaseName(), DB_VERSION);
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  at: number;
}

/**
 * Kör en full synk: skickar upp det som ändrats lokalt, hämtar det som
 * ändrats någon annanstans.
 *
 * Konfliktregeln är enkel: den senaste ändringen av en post vinner. Det
 * förutsätter att enheternas klockor går ungefär rätt, vilket de gör på
 * telefoner som hämtar tiden från nätet. Ett träningspass ändras dessutom
 * sällan från två håll samtidigt, så konflikter är i praktiken ovanliga.
 */
export async function syncNow(): Promise<SyncResult> {
  const client = supabase();
  if (!client) throw new Error("Synk är inte konfigurerad.");

  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Du är inte inloggad.");

  const db = await raw();
  const pushed = await pushChanges(db, userId);
  const pulled = await pullChanges(db);
  const at = Date.now();
  await setMeta("lastSyncAt", at);
  return { pushed, pulled, at };
}

/* ------------------------------------------------------------------ push */

async function pushChanges(
  db: IDBPDatabase,
  userId: string,
): Promise<number> {
  const client = supabase()!;
  const since = (await getMeta<number>("lastPushedAt")) ?? 0;

  const rows: RemoteRow[] = [];
  let highest = since;

  for (const store of STORES) {
    const all = (await db.getAll(store)) as Record<string, unknown>[];
    for (const record of all) {
      const updatedAt = (record.updatedAt as number) ?? 0;
      if (updatedAt <= since) continue;
      rows.push({
        kind: KINDS[store],
        id: String(record.id),
        data: record,
        updated_at: updatedAt,
        deleted_at: (record.deletedAt as number | null) ?? null,
      });
      if (updatedAt > highest) highest = updatedAt;
    }
  }

  if (rows.length === 0) return 0;

  // Servern fyller i user_id automatiskt, men vi skickar med det ändå så att
  // upsert kan matcha mot rätt primärnyckel.
  const payload = rows.map((r) => ({ ...r, user_id: userId }));

  // Delas upp så att en riktigt lång historik inte blir ett enda enormt anrop.
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await client
      .from("records")
      .upsert(payload.slice(i, i + CHUNK), {
        onConflict: "user_id,kind,id",
      });
    if (error) throw new Error(`Kunde inte skicka upp data: ${error.message}`);
  }

  await setMeta("lastPushedAt", highest);
  return rows.length;
}

/* ------------------------------------------------------------------ pull */

async function pullChanges(db: IDBPDatabase): Promise<number> {
  const client = supabase()!;
  const since = (await getMeta<number>("lastPulledAt")) ?? 0;

  let highest = since;
  let applied = 0;
  const PAGE = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await client
      .from("records")
      .select("kind,id,data,updated_at,deleted_at")
      .gt("updated_at", since)
      .order("updated_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Kunde inte hämta data: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as RemoteRow[]) {
      const store = STORES.find((s) => KINDS[s] === row.kind);
      if (!store) continue;

      const incoming = {
        ...row.data,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      };
      const existing = (await db.get(store, String(row.id))) as
        | Record<string, unknown>
        | undefined;

      // Har vi en nyare version lokalt behåller vi den — den skickas upp
      // vid nästa push och vinner då även på servern.
      if (existing && ((existing.updatedAt as number) ?? 0) >= row.updated_at) {
        continue;
      }

      await putRespectingQrKey(db, store, incoming);
      applied++;
      if (row.updated_at > highest) highest = row.updated_at;
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  await setMeta("lastPulledAt", highest);
  return applied;
}

/**
 * Skriver en post, med extra omsorg om maskinernas unika QR-nyckel.
 *
 * Registrerar man samma maskin på två enheter innan de synkat får den två
 * olika id men samma QR-kod. Indexet är unikt, så den andra skrivningen
 * kastar ett fel som annars skulle stoppa hela synken.
 *
 * Lösningen: den med lägst id vinner — ett godtyckligt men *deterministiskt*
 * val, så båda enheterna kommer fram till samma svar utan att prata med
 * varandra. Förloraren märks som borttagen och dess set flyttas över till
 * vinnaren, så att ingen träning går förlorad.
 */
async function putRespectingQrKey(
  db: IDBPDatabase,
  store: StoreName,
  record: Record<string, unknown>,
): Promise<void> {
  if (store !== "machines" || record.deletedAt) {
    await db.put(store, record);
    return;
  }

  const clash = (await db.getAllFromIndex(
    "machines",
    "byQrKey",
    record.qrKey as string,
  )) as Record<string, unknown>[];

  const other = clash.find((m) => m.id !== record.id && !m.deletedAt);
  if (!other) {
    await db.put(store, record);
    return;
  }

  const winner =
    String(record.id) < String(other.id) ? record : other;
  const loser = winner === record ? other : record;
  const now = Date.now();

  // Förloraren behåller sin QR-nyckel men märks borttagen; unika index i
  // IndexedDB bryr sig inte om vår gravsten, så nyckeln måste bort.
  await db.put(store, {
    ...loser,
    qrKey: `${loser.qrKey}#ersatt-${loser.id}`,
    deletedAt: now,
    updatedAt: now,
  });
  await db.put(store, winner);

  const orphaned = (await db.getAllFromIndex(
    "sets",
    "byMachine",
    String(loser.id),
  )) as Record<string, unknown>[];
  for (const set of orphaned) {
    await db.put("sets", {
      ...set,
      machineId: winner.id,
      updatedAt: now,
    });
  }
}

/* ----------------------------------------------------------------- status */

export async function lastSyncAt(): Promise<number | null> {
  return (await getMeta<number>("lastSyncAt")) ?? null;
}

/**
 * Nollställer synkens minne utan att röra träningsdatan.
 *
 * Används vid utloggning: nästa användare som loggar in på samma enhet ska
 * inte råka skicka upp föregående kontos poster.
 */
export async function resetSyncState(): Promise<void> {
  await setMeta("lastPushedAt", 0);
  await setMeta("lastPulledAt", 0);
  await setMeta("lastSyncAt", 0);
}
