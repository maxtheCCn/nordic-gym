"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Backup,
  Gym,
  Machine,
  Profile,
  Session,
  SetEntry,
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
}

let dbPromise: Promise<IDBPDatabase<NordicDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("Databasen finns bara i webbläsaren");
  }
  if (!dbPromise) {
    dbPromise = openDB<NordicDB>("nordic-gym", 1, {
      upgrade(db) {
        db.createObjectStore("gyms", { keyPath: "id" });

        const machines = db.createObjectStore("machines", { keyPath: "id" });
        machines.createIndex("byQrKey", "qrKey", { unique: true });
        machines.createIndex("byGym", "gymId");

        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("byStart", "startedAt");

        const sets = db.createObjectStore("sets", { keyPath: "id" });
        sets.createIndex("bySession", "sessionId");
        sets.createIndex("byMachine", "machineId");
        sets.createIndex("byTime", "timestamp");

        db.createObjectStore("profile", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
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
export function normalizeQr(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
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
  return found ?? { id: "profile" };
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const db = await getDb();
  const current = await getProfile();
  const next: Profile = { ...current, ...patch, id: "profile" };
  await db.put("profile", next);
  return next;
}

/* ------------------------------------------------------------------ gym */

export async function listGyms(): Promise<Gym[]> {
  const db = await getDb();
  const gyms = await db.getAll("gyms");
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
  const existing = (await db.getAll("gyms")).find(
    (g) => g.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;
  const gym: Gym = { id: newId(), name: trimmed, createdAt: Date.now() };
  await db.put("gyms", gym);
  return gym;
}

export async function renameGym(id: string, name: string): Promise<void> {
  const db = await getDb();
  const gym = await db.get("gyms", id);
  if (!gym) return;
  await db.put("gyms", { ...gym, name: name.trim() });
}

/* -------------------------------------------------------------- maskiner */

export async function listMachines(): Promise<Machine[]> {
  const db = await getDb();
  const machines = await db.getAll("machines");
  return machines.sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function getMachine(id: string): Promise<Machine | undefined> {
  const db = await getDb();
  return db.get("machines", id);
}

export async function findMachineByQr(raw: string): Promise<Machine | undefined> {
  const db = await getDb();
  const key = normalizeQr(raw);
  if (!key) return undefined;
  return db.getFromIndex("machines", "byQrKey", key);
}

export async function saveMachine(
  machine: Omit<Machine, "id" | "createdAt"> & { id?: string; createdAt?: number },
): Promise<Machine> {
  const db = await getDb();
  const full: Machine = {
    ...machine,
    id: machine.id ?? newId(),
    createdAt: machine.createdAt ?? Date.now(),
  };
  await db.put("machines", full);
  return full;
}

export async function deleteMachine(id: string): Promise<void> {
  const db = await getDb();
  const sets = await db.getAllFromIndex("sets", "byMachine", id);
  const tx = db.transaction(["machines", "sets"], "readwrite");
  await Promise.all([
    tx.objectStore("machines").delete(id),
    ...sets.map((s) => tx.objectStore("sets").delete(s.id)),
    tx.done,
  ]);
}

/* ------------------------------------------------------------------ pass */

export async function listSessions(): Promise<Session[]> {
  const db = await getDb();
  const sessions = await db.getAll("sessions");
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDb();
  return db.get("sessions", id);
}

/** Passet som pågår just nu, om något. */
export async function getActiveSession(): Promise<Session | undefined> {
  const db = await getDb();
  const sessions = await db.getAll("sessions");
  return sessions
    .filter((s) => s.endedAt === null)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function startSession(gymId: string): Promise<Session> {
  const db = await getDb();
  const active = await getActiveSession();
  if (active) return active;
  const session: Session = {
    id: newId(),
    gymId,
    startedAt: Date.now(),
    endedAt: null,
  };
  await db.put("sessions", session);
  return session;
}

export async function endSession(id: string): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", id);
  if (!session || session.endedAt !== null) return;
  await db.put("sessions", { ...session, endedAt: Date.now() });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const sets = await db.getAllFromIndex("sets", "bySession", id);
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  await Promise.all([
    tx.objectStore("sessions").delete(id),
    ...sets.map((s) => tx.objectStore("sets").delete(s.id)),
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
  const sets = await db.getAll("sets");
  return sets.sort((a, b) => a.timestamp - b.timestamp);
}

export async function setsForSession(sessionId: string): Promise<SetEntry[]> {
  const db = await getDb();
  const sets = await db.getAllFromIndex("sets", "bySession", sessionId);
  return sets.sort((a, b) => a.timestamp - b.timestamp);
}

export async function setsForMachine(machineId: string): Promise<SetEntry[]> {
  const db = await getDb();
  const sets = await db.getAllFromIndex("sets", "byMachine", machineId);
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
  input: Omit<SetEntry, "id" | "setNumber" | "timestamp" | "restSec"> & {
    timestamp?: number;
  },
): Promise<SetEntry> {
  const db = await getDb();
  const timestamp = input.timestamp ?? Date.now();
  const sessionSets = await db.getAllFromIndex(
    "sets",
    "bySession",
    input.sessionId,
  );

  const setNumber =
    sessionSets.filter((s) => s.machineId === input.machineId).length + 1;

  const previous = sessionSets
    .filter((s) => s.timestamp < timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const restSec = previous
    ? Math.round((timestamp - previous.timestamp) / 1000)
    : undefined;

  const entry: SetEntry = { ...input, id: newId(), setNumber, timestamp, restSec };
  await db.put("sets", entry);
  return entry;
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("sets", id);
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
 * Läser in en säkerhetskopia. Poster med id som redan finns skrivs över,
 * övriga läggs till — så det går att slå ihop data från två telefoner.
 */
export async function importBackup(backup: Backup): Promise<void> {
  if (backup?.format !== "nordic-gym") {
    throw new Error("Filen är inte en giltig säkerhetskopia från appen.");
  }
  const db = await getDb();
  const tx = db.transaction(
    ["gyms", "machines", "sessions", "sets", "profile"],
    "readwrite",
  );
  await Promise.all([
    ...backup.gyms.map((g) => tx.objectStore("gyms").put(g)),
    ...backup.machines.map((m) => tx.objectStore("machines").put(m)),
    ...backup.sessions.map((s) => tx.objectStore("sessions").put(s)),
    ...backup.sets.map((s) => tx.objectStore("sets").put(s)),
    backup.profile ? tx.objectStore("profile").put(backup.profile) : undefined,
    tx.done,
  ]);
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["gyms", "machines", "sessions", "sets", "profile"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("gyms").clear(),
    tx.objectStore("machines").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("sets").clear(),
    tx.objectStore("profile").clear(),
    tx.done,
  ]);
}
