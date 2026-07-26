"use client";

import type { Gym, Machine, Profile, Session, SetEntry } from "./types";

const FLAG = "nw-demo";

/**
 * Demoläget byter ut hela databasen mot en egen.
 *
 * Alternativet — att märka varje post som "demo" och filtrera bort den — hade
 * krävt att varje statistikuträkning, rapport och lista kom ihåg att göra det.
 * Ett enda ställe som glömmer det förorenar den riktiga loggen permanent. Med
 * en separat databas är det omöjligt: den riktiga datan rörs helt enkelt inte.
 */
export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FLAG) === "1";
}

export function databaseName(): string {
  return isDemo() ? "nordic-gym-demo" : "nordic-gym";
}

/**
 * Slår om läget och laddar om sidan.
 *
 * Omladdningen är avsiktlig: den öppna databasanslutningen, allt inläst i
 * minnet och alla pågående vyer pekar på fel databas efter omslaget. Att
 * försöka byta ut det i farten är en säker väg till svårfunna fel.
 */
function setDemo(on: boolean) {
  if (on) window.localStorage.setItem(FLAG, "1");
  else window.localStorage.removeItem(FLAG);
  // På GitHub Pages ligger appen under /nordic-gym, lokalt på roten. Utan
  // prefixet hamnar man på en 404 i det ena eller andra läget.
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  window.location.href = on ? `${base}/` : `${base}/settings/`;
}

export function enterDemo() {
  setDemo(true);
}

export function exitDemo() {
  setDemo(false);
}

/** Raderar demodatabasen helt. Den riktiga ligger under ett annat namn. */
export function resetDemoData(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("nordic-gym-demo");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/* ------------------------------------------------------------- exempeldata */

const DAY = 86_400_000;

interface Seed {
  gyms: Gym[];
  machines: Machine[];
  sessions: Session[];
  sets: SetEntry[];
  profile: Profile;
}

/**
 * Bygger tre pass bakåt i tiden så att statistik, historik och rapport har
 * något att visa. Vikterna ökar mellan passen — annars ser kurvorna döda ut
 * och man förstår inte vad sidorna är till för.
 */
export function demoSeed(): Seed {
  const now = Date.now();
  const gym: Gym = {
    id: "demo-gym",
    name: "Nordic Wellness (demo)",
    createdAt: now - 30 * DAY,
    updatedAt: now,
    deletedAt: null,
  };

  const specs: [id: string, name: string, group: Machine["muscleGroup"], base: number][] = [
    ["d1", "Chest press", "Bröst", 35],
    ["d2", "Lat pulldown", "Rygg", 45],
    ["d3", "Shoulder press", "Axlar", 20],
    ["d4", "Ben press", "Ben", 95],
    ["d5", "Triceps extension", "Triceps", 25],
  ];

  const machines: Machine[] = specs.map(([id, name, muscleGroup]) => ({
    id,
    qrKey: `demo:${id}`,
    qrRaw: "",
    gymId: gym.id,
    name,
    muscleGroup,
    type: "strength",
    metrics: ["weight", "extraPlate", "reps"],
    plateOptions: [2.5, 3.75, 5],
    weightStep: 2.5,
    targetSets: 3,
    createdAt: now - 30 * DAY,
    updatedAt: now,
    deletedAt: null,
  }));

  machines.push({
    id: "d6",
    qrKey: "demo:d6",
    qrRaw: "",
    gymId: gym.id,
    name: "Löpband",
    muscleGroup: "Kondition",
    type: "cardio",
    metrics: ["time", "speed", "distance"],
    plateOptions: [],
    weightStep: 2.5,
    targetSets: 1,
    createdAt: now - 30 * DAY,
    updatedAt: now,
    deletedAt: null,
  });

  const sessions: Session[] = [];
  const sets: SetEntry[] = [];
  let n = 0;

  // Tre pass: för 16, 9 och 2 dagar sedan.
  [16, 9, 2].forEach((daysAgo, passIndex) => {
    const start = now - daysAgo * DAY + 17 * 3600_000;
    const session: Session = {
      id: `demo-s${passIndex}`,
      gymId: gym.id,
      startedAt: start,
      endedAt: start + 52 * 60_000,
      updatedAt: now,
      deletedAt: null,
    };
    sessions.push(session);

    let clock = start + 5 * 60_000;
    for (const [id, , , base] of specs) {
      // 2,5 kg mer per pass — en realistisk nybörjarökning.
      const weight = base + passIndex * 2.5;
      for (let setNo = 1; setNo <= 3; setNo++) {
        sets.push({
          id: `demo-set-${n++}`,
          sessionId: session.id,
          machineId: id,
          setNumber: setNo,
          timestamp: clock,
          weight,
          extraWeight: setNo < 3 ? 3.75 : undefined,
          reps: 10,
          restSec: 105,
          updatedAt: now,
          deletedAt: null,
        });
        clock += 105_000;
      }
      clock += 60_000;
    }

    sets.push({
      id: `demo-set-${n++}`,
      sessionId: session.id,
      machineId: "d6",
      setNumber: 1,
      timestamp: clock,
      durationSec: 600,
      speed: 10,
      distanceKm: 1.7,
      restSec: 120,
      updatedAt: now,
      deletedAt: null,
    });
  });

  return {
    gyms: [gym],
    machines,
    sessions,
    sets,
    profile: {
      id: "profile",
      name: "Demo",
      age: 16,
      bodyWeight: 70,
      goal: "Bygga muskler",
      homeGymId: gym.id,
      updatedAt: now,
    },
  };
}
