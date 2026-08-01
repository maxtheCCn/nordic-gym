"use client";

import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type StoreNames,
} from "idb";
import { databaseName, demoSeed, isDemo } from "./demo";
import type {
  Backup,
  Gym,
  Machine,
  Plan,
  PlanImport,
  Profile,
  Session,
  SetEntry,
  SupplementEntry,
} from "./types";

interface NordicDB extends DBSchema {
  gyms: { key: string; value: Gym };
  machines: {
    key: string;
    value: Machine;
    indexes: { byQrKey: string; byGym: string };
  };
  sessions: { key: string; value: Session; indexes: { byStart: number } };
  sets: {
    key: string;
    value: SetEntry;
    indexes: { bySession: string; byMachine: string; byTime: number };
  };
  profile: { key: string; value: Profile };
  /** Rekommenderade pass — skrivna utanför appen, lagrade här. */
  plans: { key: string; value: Plan };
  supplements: {
    key: string;
    value: SupplementEntry;
    indexes: { byTime: number };
  };
  /** Småsaker som inte hör hemma i loggen, t.ex. tidpunkt för senaste synk. */
  meta: { key: string; value: { key: string; value: unknown } };
}

/**
 * Höj den här när ett nytt lager eller index behövs.
 *
 * Exporteras så att sync.ts öppnar samma version — öppnar två delar av appen
 * databasen med olika versionsnummer blockerar de varandra.
 */
export const DB_VERSION = 5;

let dbPromise: Promise<IDBPDatabase<NordicDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("Databasen finns bara i webbläsaren");
  }
  if (!dbPromise) {
    // I demoläget öppnas en helt annan databas, så inget kan blandas ihop.
    dbPromise = openDB<NordicDB>(databaseName(), DB_VERSION, {
      /*
       * Migreringen utgår från vad som faktiskt finns, inte från vilket
       * versionsnummer databasen påstår sig ha.
       *
       * Med rena versionsjämförelser räcker det att versionen hinner skrivas
       * upp utan att lagret skapas — vid ett avbrutet bygge eller en
       * omladdning mitt i en ändring — för att databasen ska bli permanent
       * trasig: nästa öppning ser rätt version och hoppar över steget. Med
       * `contains` läker den sig själv i stället.
       */
      upgrade(db) {
        const need = (name: StoreNames<NordicDB>) =>
          !db.objectStoreNames.contains(name);

        if (need("gyms")) db.createObjectStore("gyms", { keyPath: "id" });

        if (need("machines")) {
          const machines = db.createObjectStore("machines", { keyPath: "id" });
          machines.createIndex("byQrKey", "qrKey", { unique: true });
          machines.createIndex("byGym", "gymId");
        }

        if (need("sessions")) {
          const sessions = db.createObjectStore("sessions", { keyPath: "id" });
          sessions.createIndex("byStart", "startedAt");
        }

        if (need("sets")) {
          const sets = db.createObjectStore("sets", { keyPath: "id" });
          sets.createIndex("bySession", "sessionId");
          sets.createIndex("byMachine", "machineId");
          sets.createIndex("byTime", "timestamp");
        }

        if (need("profile")) db.createObjectStore("profile", { keyPath: "id" });
        if (need("meta")) db.createObjectStore("meta", { keyPath: "key" });
        if (need("plans")) db.createObjectStore("plans", { keyPath: "id" });

        if (need("supplements")) {
          const supplements = db.createObjectStore("supplements", {
            keyPath: "id",
          });
          supplements.createIndex("byTime", "timestamp");
        }
      },
      /*
       * Den här fliken håller en äldre version öppen medan en annan flik vill
       * uppgradera. Stänger vi inte får ingen av dem fortsätta: den andra
       * fliken blockeras för alltid och användaren ser bara "Laddar…".
       */
      blocking() {
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
      blocked() {
        throw new Error(
          "Appen är öppen i en annan flik med en äldre version. Stäng övriga " +
            "flikar med appen och ladda om.",
        );
      },
      terminated() {
        // Webbläsaren stängde anslutningen (t.ex. vid minnesbrist).
        // Nästa anrop öppnar en ny i stället för att använda en död.
        dbPromise = null;
      },
    }).then(async (db) => {
      await backfillTimestamps(db);
      await repairSetNumbers(db);
      await seedDemoIfEmpty(db);
      return db;
    });
  }
  return dbPromise;
}

const SYNCABLE = ["gyms", "machines", "sessions", "sets", "profile"] as const;

/**
 * Ger poster som skapades innan synken fanns en `updatedAt`.
 *
 * Utan den skulle de aldrig skickas upp till servern — synken frågar efter
 * "allt som ändrats sedan sist" och en post utan tidsstämpel svarar aldrig ja.
 * De dateras efter när de faktiskt uppstod, så att en nyare ändring på en
 * annan enhet fortfarande vinner över dem.
 *
 * Körs efter att databasen öppnats i stället för inuti uppgraderingen: en
 * uppgraderingstransaktion stängs så fort den slutar användas, och att blanda
 * in egna löften där är ett känt sätt att tappa halva migreringen.
 */
async function backfillTimestamps(db: IDBPDatabase<NordicDB>): Promise<void> {
  const done = await db.get("meta", "backfilledTimestamps");
  if (done) return;

  for (const name of SYNCABLE) {
    const rows = (await db.getAll(name)) as unknown as Record<string, unknown>[];
    const missing = rows.filter((r) => typeof r.updatedAt !== "number");
    for (const row of missing) {
      row.updatedAt =
        (row.createdAt as number) ??
        (row.timestamp as number) ??
        (row.startedAt as number) ??
        Date.now();
      row.deletedAt = null;
      await db.put(name, row as never);
    }
  }

  await db.put("meta", { key: "backfilledTimestamps", value: true });
}

/**
 * Rättar setnummer som blev fel innan omnumreringen fanns.
 *
 * Tidigare lämnades kvarvarande set orörda när ett togs bort, så en logg kunde
 * innehålla ett "Set 2" utan något Set 1. Körs en gång och rör bara numren.
 */
async function repairSetNumbers(db: IDBPDatabase<NordicDB>): Promise<void> {
  const done = await db.get("meta", "repairedSetNumbers");
  if (done) return;

  const sets = alive(await db.getAll("sets"));
  const groups = new Map<string, typeof sets>();
  for (const s of sets) {
    const key = `${s.sessionId}|${s.machineId}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < list.length; i++) {
      if (list[i].setNumber === i + 1) continue;
      await db.put("sets", { ...list[i], setNumber: i + 1 });
    }
  }

  await db.put("meta", { key: "repairedSetNumbers", value: true });
}

/**
 * Fyller demodatabasen med exempeldata första gången den öppnas.
 *
 * Utan innehåll är demot meningslöst — statistik, historik och rapport skulle
 * alla vara tomma, och det är just de sidorna man vill titta på. Körs bara när
 * databasen är tom, så det man själv petar på i demot blir kvar.
 */
async function seedDemoIfEmpty(db: IDBPDatabase<NordicDB>): Promise<void> {
  if (!isDemo()) return;
  if ((await db.count("machines")) > 0) return;

  const seed = demoSeed();
  const tx = db.transaction(
    ["gyms", "machines", "sessions", "sets", "profile"],
    "readwrite",
  );
  await Promise.all([
    ...seed.gyms.map((g) => tx.objectStore("gyms").put(g)),
    ...seed.machines.map((m) => tx.objectStore("machines").put(m)),
    ...seed.sessions.map((s) => tx.objectStore("sessions").put(s)),
    ...seed.sets.map((s) => tx.objectStore("sets").put(s)),
    tx.objectStore("profile").put(seed.profile),
    tx.done,
  ]);
}

/** Stämplar en post som ändrad nu. All skrivning går genom den här. */
function touch<T extends object>(record: T): T & { updatedAt: number } {
  return { ...record, updatedAt: Date.now() };
}

/** Filtrerar bort gravstenar — raderade poster ska inte synas i appen. */
function alive<T extends { deletedAt?: number | null }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

/* ------------------------------------------------------------------- meta */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get("meta", key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value });
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Gör QR-innehållet till en stabil nyckel.
 *
 * Nordic Wellness QR-koder är länkar och kan variera i småsaker mellan
 * skanningar (http/https, trailing slash, spårningsparametrar som utm_*).
 * Vi plockar ut den identifierande delen så att samma maskin alltid ger
 * samma nyckel. Är innehållet inte en URL används råtexten trimmad.
 */
/**
 * Life Fitness LFconnect-koder ser ut så här:
 *
 *   https://trainer.lifefitness.com/qrredirect
 *     ?referer-link=<base64 av https://halo.fitness/q?t=s&m=sste>
 *     &referer-type=STRENGTH
 *     &url-video=prJVihX68jA
 *
 * Det som identifierar maskinen är `t` (typ) och `m` (modell) inuti den
 * base64-kodade länken. Resten är kringinfo — `url-video` pekar bara på en
 * instruktionsfilm och kan ändras utan att maskinen gör det.
 *
 * Genom att plocka ut t+m blir nyckeln kort, läsbar och tål att Life Fitness
 * lägger till, tar bort eller kastar om parametrar. Returnerar null när koden
 * inte är en LFconnect-kod, så att den generella normaliseringen tar vid.
 */
function lifeFitnessKey(url: URL): string | null {
  if (!/(^|\.)lifefitness\.com$/i.test(url.hostname)) return null;
  const encoded = url.searchParams.get("referer-link");
  if (!encoded) return null;
  try {
    const inner = new URL(atob(encoded));
    const type = inner.searchParams.get("t");
    const model = inner.searchParams.get("m");
    if (!model) return null;
    return `lifefitness:${type ?? "?"}:${model}`.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeQr(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  try {
    const url = new URL(text);

    const lf = lifeFitnessKey(url);
    if (lf) return lf;

    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) params.delete(key);
    }
    const query = params.toString();
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
  } catch {
    return text.toLowerCase();
  }
}

/* ---------------------------------------------------------------- profil */

export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  const found = await db.get("profile", "profile");
  return found ?? { id: "profile", updatedAt: 0 };
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const db = await getDb();
  const current = await getProfile();
  const next = touch({ ...current, ...patch, id: "profile" as const });
  await db.put("profile", next);
  return next;
}

/* ------------------------------------------------------------------ gym */

export async function listGyms(): Promise<Gym[]> {
  const db = await getDb();
  const gyms = alive(await db.getAll("gyms"));
  return gyms.sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function getGym(id: string): Promise<Gym | undefined> {
  const db = await getDb();
  return db.get("gyms", id);
}

/** Hämtar gymmet med det namnet, eller skapar det om det inte finns. */
export async function ensureGym(name: string): Promise<Gym> {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = alive(await db.getAll("gyms")).find(
    (g) => g.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;
  const gym = touch({
    id: newId(),
    name: trimmed,
    createdAt: Date.now(),
    deletedAt: null,
  });
  await db.put("gyms", gym);
  return gym;
}

export async function renameGym(id: string, name: string): Promise<void> {
  const db = await getDb();
  const gym = await db.get("gyms", id);
  if (!gym) return;
  await db.put("gyms", touch({ ...gym, name: name.trim() }));
}

/* -------------------------------------------------------------- maskiner */

export async function listMachines(): Promise<Machine[]> {
  const db = await getDb();
  const machines = alive(await db.getAll("machines"));
  return machines.sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function getMachine(id: string): Promise<Machine | undefined> {
  const db = await getDb();
  const machine = await db.get("machines", id);
  return machine?.deletedAt ? undefined : machine;
}

export async function findMachineByQr(raw: string): Promise<Machine | undefined> {
  const db = await getDb();
  const key = normalizeQr(raw);
  if (!key) return undefined;
  const machine = await db.getFromIndex("machines", "byQrKey", key);
  // En raderad maskin ska inte kännas igen — skanningen ska leda till
  // registrering på nytt, inte till en gravsten.
  return machine?.deletedAt ? undefined : machine;
}

export async function saveMachine(
  machine: Omit<Machine, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: number;
  },
): Promise<Machine> {
  const db = await getDb();
  const full = touch({
    deletedAt: null,
    ...machine,
    id: machine.id ?? newId(),
    createdAt: machine.createdAt ?? Date.now(),
  });
  await db.put("machines", full);
  return full;
}

export async function deleteMachine(id: string): Promise<void> {
  const db = await getDb();
  const machine = await db.get("machines", id);
  const sets = await db.getAllFromIndex("sets", "byMachine", id);
  const now = Date.now();
  const tx = db.transaction(["machines", "sets"], "readwrite");
  await Promise.all([
    machine
      ? tx.objectStore("machines").put({ ...machine, deletedAt: now, updatedAt: now })
      : undefined,
    ...sets.map((s) =>
      tx.objectStore("sets").put({ ...s, deletedAt: now, updatedAt: now }),
    ),
    tx.done,
  ]);
}

/* ------------------------------------------------------------------ pass */

export async function listSessions(): Promise<Session[]> {
  const db = await getDb();
  const sessions = alive(await db.getAll("sessions"));
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDb();
  const session = await db.get("sessions", id);
  return session?.deletedAt ? undefined : session;
}

/** Passet som pågår just nu, om något. */
export async function getActiveSession(): Promise<Session | undefined> {
  const db = await getDb();
  const sessions = alive(await db.getAll("sessions"));
  return sessions
    .filter((s) => s.endedAt === null)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function startSession(gymId: string): Promise<Session> {
  const db = await getDb();
  const active = await getActiveSession();
  if (active) return active;
  const session = touch({
    id: newId(),
    gymId,
    startedAt: Date.now(),
    endedAt: null,
    deletedAt: null,
  });
  await db.put("sessions", session);
  return session;
}

export async function endSession(id: string): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", id);
  if (!session || session.endedAt !== null) return;
  await db.put("sessions", touch({ ...session, endedAt: Date.now() }));
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", id);
  const sets = await db.getAllFromIndex("sets", "bySession", id);
  const now = Date.now();
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  await Promise.all([
    session
      ? tx.objectStore("sessions").put({ ...session, deletedAt: now, updatedAt: now })
      : undefined,
    ...sets.map((s) =>
      tx.objectStore("sets").put({ ...s, deletedAt: now, updatedAt: now }),
    ),
    tx.done,
  ]);
}

/**
 * Ser till att det finns ett pågående pass att logga i.
 *
 * Ett pass som startades för mer än 6 timmar sedan har användaren nästan
 * säkert glömt att avsluta — då stängs det och ett nytt startas.
 */
const MAX_SESSION_MS = 6 * 60 * 60 * 1000;

export async function ensureActiveSession(gymId: string): Promise<Session> {
  const active = await getActiveSession();
  if (active) {
    if (Date.now() - active.startedAt < MAX_SESSION_MS) return active;
    await endSession(active.id);
  }
  return startSession(gymId);
}

/* ------------------------------------------------------------------- set */

export async function listSets(): Promise<SetEntry[]> {
  const db = await getDb();
  const sets = alive(await db.getAll("sets"));
  return sets.sort((a, b) => a.timestamp - b.timestamp);
}

export async function setsForSession(sessionId: string): Promise<SetEntry[]> {
  const db = await getDb();
  const sets = alive(await db.getAllFromIndex("sets", "bySession", sessionId));
  return sets.sort((a, b) => a.timestamp - b.timestamp);
}

export async function setsForMachine(machineId: string): Promise<SetEntry[]> {
  const db = await getDb();
  const sets = alive(await db.getAllFromIndex("sets", "byMachine", machineId));
  return sets.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Sparar ett set och räknar automatiskt ut setnummer och vila.
 *
 * Setnumret är antalet set på samma maskin i samma pass + 1. Vilan är tiden
 * sedan senaste setet i passet — oavsett maskin, eftersom det är den faktiska
 * pausen användaren tog.
 */
export async function addSet(
  input: Omit<
    SetEntry,
    "id" | "setNumber" | "timestamp" | "restSec" | "updatedAt"
  > & {
    timestamp?: number;
  },
): Promise<SetEntry> {
  const db = await getDb();
  const timestamp = input.timestamp ?? Date.now();
  const sessionSets = alive(
    await db.getAllFromIndex("sets", "bySession", input.sessionId),
  );

  const setNumber =
    sessionSets.filter((s) => s.machineId === input.machineId).length + 1;

  const previous = sessionSets
    .filter((s) => s.timestamp < timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const restSec = previous
    ? Math.round((timestamp - previous.timestamp) / 1000)
    : undefined;

  const entry = touch({
    deletedAt: null,
    ...input,
    id: newId(),
    setNumber,
    timestamp,
    restSec,
  });
  await db.put("sets", entry);
  return entry;
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb();
  const set = await db.get("sets", id);
  if (!set) return;
  // Gravsten i stället för borttagning, annars kommer setet tillbaka vid
  // nästa synk från en enhet som inte känner till raderingen.
  await db.put("sets", touch({ ...set, deletedAt: Date.now() }));
  await renumberSets(db, set.sessionId, set.machineId);
}

/**
 * Numrerar om seten på en maskin inom ett pass, 1 och uppåt.
 *
 * Raderar man set 1 av tre skulle de kvarvarande annars heta 2 och 3, och
 * loggen visa ett set nummer 2 som inget föregår. Numret ska beskriva
 * ordningen man faktiskt gjorde dem i.
 */
async function renumberSets(
  db: IDBPDatabase<NordicDB>,
  sessionId: string,
  machineId: string,
): Promise<void> {
  const siblings = alive(await db.getAllFromIndex("sets", "bySession", sessionId))
    .filter((s) => s.machineId === machineId)
    .sort((a, b) => a.timestamp - b.timestamp);

  const now = Date.now();
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].setNumber === i + 1) continue;
    await db.put("sets", { ...siblings[i], setNumber: i + 1, updatedAt: now });
  }
}

/* ------------------------------------------------------------ tillskott */

export async function listSupplements(): Promise<SupplementEntry[]> {
  const db = await getDb();
  return alive(await db.getAll("supplements")).sort(
    (a, b) => b.timestamp - a.timestamp,
  );
}

export async function addSupplement(
  input: Omit<SupplementEntry, "id" | "updatedAt" | "timestamp"> & {
    timestamp?: number;
  },
): Promise<SupplementEntry> {
  const db = await getDb();
  const entry = touch({
    deletedAt: null,
    ...input,
    id: newId(),
    timestamp: input.timestamp ?? Date.now(),
  });
  await db.put("supplements", entry);
  return entry;
}

export async function deleteSupplement(id: string): Promise<void> {
  const db = await getDb();
  const entry = await db.get("supplements", id);
  if (!entry) return;
  await db.put("supplements", touch({ ...entry, deletedAt: Date.now() }));
}

/* ------------------------------------------------ rekommenderade pass */

export async function listPlans(): Promise<Plan[]> {
  const db = await getDb();
  return alive(await db.getAll("plans")).sort((a, b) =>
    a.name.localeCompare(b.name, "sv"),
  );
}

/**
 * Lägger till pass från en inklistrad plan.
 *
 * Pass med samma namn ersätts. Får man en uppdaterad version av "Pass A" ska
 * den ta över, inte hamna bredvid den gamla — annars vet man inte vilken som
 * gäller när man står vid maskinen.
 */
export async function importPlans(input: PlanImport): Promise<number> {
  if (input?.format !== "nw-plan" || !Array.isArray(input.plans)) {
    throw new Error(
      "Texten är inte ett giltigt pass. Kopiera hela blocket du fick, inklusive klamrarna.",
    );
  }
  const db = await getDb();
  const existing = alive(await db.getAll("plans"));

  for (const incoming of input.plans) {
    if (!incoming?.name || !Array.isArray(incoming.exercises)) continue;
    const previous = existing.find(
      (p) => p.name.toLowerCase() === incoming.name.toLowerCase(),
    );
    await db.put(
      "plans",
      touch({
        id: previous?.id ?? newId(),
        name: incoming.name,
        note: incoming.note,
        exercises: incoming.exercises,
        createdAt: previous?.createdAt ?? Date.now(),
        deletedAt: null,
      }),
    );
  }
  return input.plans.length;
}

export async function deletePlan(id: string): Promise<void> {
  const db = await getDb();
  const plan = await db.get("plans", id);
  if (!plan) return;
  await db.put("plans", touch({ ...plan, deletedAt: Date.now() }));
}

/* --------------------------------------------------------- export/import */

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const [gyms, machines, sessions, sets, profile] = await Promise.all([
    db.getAll("gyms"),
    db.getAll("machines"),
    db.getAll("sessions"),
    db.getAll("sets"),
    db.get("profile", "profile"),
  ]);
  return {
    format: "nordic-gym",
    version: 1,
    exportedAt: Date.now(),
    gyms,
    machines,
    sessions,
    sets,
    profile: profile ?? null,
  };
}

/**
 * Läser in en säkerhetskopia och slår ihop den med det som redan finns.
 *
 * Vid krock vinner den nyaste versionen av posten, precis som vid synk. Det
 * gör att en gammal exportfil inte kan skriva över nyare träningar.
 */
export async function importBackup(backup: Backup): Promise<void> {
  if (backup?.format !== "nordic-gym") {
    throw new Error("Filen är inte en giltig säkerhetskopia från appen.");
  }
  const db = await getDb();

  const merge = async (
    name: "gyms" | "machines" | "sessions" | "sets" | "profile",
    rows: { id: string; updatedAt?: number; deletedAt?: number | null }[],
  ) => {
    for (const row of rows) {
      const existing = (await db.get(name, row.id)) as
        | { updatedAt?: number; deletedAt?: number | null }
        | undefined;
      const incoming = row.updatedAt ?? 0;

      /*
       * En post som finns i kopian men är raderad lokalt ska tillbaka.
       *
       * "Radera all data" märker varje post som borttagen med dagens
       * tidsstämpel. Med enbart nyast-vinner slog de raderingarna ut hela
       * säkerhetskopian, och återställningen sa "klart" utan att något kom
       * tillbaka — värsta tänkbara utfall för den som just tömt appen av
       * misstag. Att importera en kopia är ett uttryckligt "lägg tillbaka
       * det här", och väger tyngre än en tidigare radering.
       */
      const revives = Boolean(existing?.deletedAt) && !row.deletedAt;

      if (existing && !revives && (existing.updatedAt ?? 0) > incoming) continue;
      await db.put(name, {
        updatedAt: incoming,
        ...row,
        // Utan detta behåller posten sin gravsten och förblir osynlig.
        ...(revives ? { deletedAt: null, updatedAt: Date.now() } : {}),
      } as never);
    }
  };

  await merge("gyms", backup.gyms);
  await merge("machines", backup.machines);
  await merge("sessions", backup.sessions);
  await merge("sets", backup.sets);
  if (backup.profile) await merge("profile", [backup.profile]);
}

/**
 * Raderar allt.
 *
 * Poster märks som borttagna i stället för att försvinna, så att raderingen
 * når andra enheter vid nästa synk. Försvann de spårlöst skulle nästa synk
 * bara ladda ner allt igen.
 */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  for (const name of SYNCABLE) {
    const rows = (await db.getAll(name)) as { id: string }[];
    for (const row of rows) {
      await db.put(name, { ...row, deletedAt: now, updatedAt: now } as never);
    }
  }
}
