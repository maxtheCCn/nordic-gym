/**
 * Datamodell för träningsloggen.
 *
 * Allt lagras lokalt i IndexedDB. Id:n är strängar (crypto.randomUUID) så att
 * datan kan flyttas mellan enheter via export/import utan id-krockar.
 */

/** Vad en maskin mäter. Styr vilka fält som visas på loggningssidan. */
export type Metric =
  | "weight"
  | "extraPlate"
  | "reps"
  | "time"
  | "speed"
  | "distance"
  | "incline";

export type MachineType = "strength" | "cardio" | "bodyweight" | "free";

export type MuscleGroup =
  | "Bröst"
  | "Rygg"
  | "Axlar"
  | "Biceps"
  | "Triceps"
  | "Ben"
  | "Vader"
  | "Mage"
  | "Helkropp"
  | "Kondition";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Bröst",
  "Rygg",
  "Axlar",
  "Biceps",
  "Triceps",
  "Ben",
  "Vader",
  "Mage",
  "Helkropp",
  "Kondition",
];

export const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  strength: "Styrkemaskin",
  cardio: "Konditionsmaskin",
  bodyweight: "Kroppsvikt",
  free: "Fria vikter",
};

/** Standardmätvärden per maskintyp — förifylls när en ny maskin registreras. */
export const DEFAULT_METRICS: Record<MachineType, Metric[]> = {
  strength: ["weight", "extraPlate", "reps"],
  cardio: ["time", "speed", "distance"],
  bodyweight: ["reps"],
  free: ["weight", "reps"],
};

/**
 * Fälten synken behöver på varje post.
 *
 * `updatedAt` avgör vem som vinner när samma post ändrats på två enheter —
 * senaste skrivningen gäller. `deletedAt` gör raderingar till gravstenar:
 * en post som bara försvann lokalt skulle läsas tillbaka från servern vid
 * nästa synk, så den måste finnas kvar och vara märkt borttagen.
 */
export interface Synced {
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Gym extends Synced {
  id: string;
  name: string;
  createdAt: number;
}

export interface Machine extends Synced {
  id: string;
  /** Normaliserad QR-sträng. Unikt index — det är så maskinen känns igen. */
  qrKey: string;
  /** Rå QR-data precis som den skannades, sparas för felsökning. */
  qrRaw: string;
  gymId: string;
  name: string;
  muscleGroup: MuscleGroup;
  type: MachineType;
  metrics: Metric[];
  /** Extra viktplattor som finns på just den här maskinen, i kg. */
  plateOptions: number[];
  /** Minsta viktsteg på stacken, i kg. Styr +/- knapparna. */
  weightStep: number;
  /**
   * Hur många set man brukar köra på maskinen. Styr "Set 2 av 3" på
   * loggningssidan och följer med i AI-rapporten som planerat upplägg.
   * Odefinierat på maskiner som lagts till innan fältet fanns — då visas
   * ingen målräkning.
   */
  targetSets?: number;
  note?: string;
  createdAt: number;
}

export interface Session extends Synced {
  id: string;
  gymId: string;
  startedAt: number;
  /** null = passet pågår just nu. */
  endedAt: number | null;
  note?: string;
}

export interface SetEntry extends Synced {
  id: string;
  sessionId: string;
  machineId: string;
  /** Setnummer inom passet för just den maskinen, börjar på 1. */
  setNumber: number;
  timestamp: number;
  weight?: number;
  extraWeight?: number;
  reps?: number;
  /** Sekunder — för konditionsmaskiner. */
  durationSec?: number;
  speed?: number;
  distanceKm?: number;
  incline?: number;
  /** Sekunder sedan föregående set i samma pass. Beräknas automatiskt. */
  restSec?: number;
}

export type Goal =
  | "Bygga muskler"
  | "Gå ner i vikt"
  | "Bli starkare"
  | "Bättre kondition"
  | "Hålla igång";

export const GOALS: Goal[] = [
  "Bygga muskler",
  "Gå ner i vikt",
  "Bli starkare",
  "Bättre kondition",
  "Hålla igång",
];

export interface Profile extends Synced {
  id: "profile";
  name?: string;
  age?: number;
  bodyWeight?: number;
  goal?: Goal;
  /** Gymmet som väljs automatiskt när ett nytt pass startas. */
  homeGymId?: string;
}

/** Formen på export/import-filen. */
export interface Backup {
  format: "nordic-gym";
  version: 1;
  exportedAt: number;
  gyms: Gym[];
  machines: Machine[];
  sessions: Session[];
  sets: SetEntry[];
  profile: Profile | null;
}
