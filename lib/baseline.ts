import type { MachineType, Metric, MuscleGroup } from "./types";

/**
 * Baslistan över maskiner och redskap på Nordic Wellness.
 *
 * Katalogen är byggd på övningar, inte fabrikat. Utrustningen skiljer sig
 * mellan klubbarna — Odenplan har Life Fitness och Hammer Strength,
 * Gästrikegatan Hoist och Eleiko, Döbelnsgatan Gym 80 — så en lista över
 * maskinmodeller hade bara stämt på ett gym. Övningsnamn fungerar överallt.
 *
 * Allt går att döpa om, ändra och ta bort. Det som aldrig loggats märks
 * "Inte använd" i listan, så en lång katalog inte gör det svårare att hitta
 * det man faktiskt kör.
 */

export interface BaselineMachine {
  name: string;
  muscleGroup: MuscleGroup;
  type: MachineType;
  /**
   * Life Fitness modellkod, där den är känd från riktiga skanningar. Ger
   * maskinen samma nyckel som QR-koden på gymmet, så att en skanning hittar
   * baslistans maskin i stället för att skapa en dubblett.
   */
  code?: string;
  note?: string;
}

const M: Metric[] = ["weight", "extraPlate", "reps"];
const FREE: Metric[] = ["weight", "reps"];

/**
 * Baslistan innehåller bara fria vikter och redskap — inga maskiner.
 *
 * Katalogen var först full av maskiner, men eftersom varje maskin har en
 * QR-kod på gymmet blev de överflödiga: man skannar den och får den på köpet.
 * Kvar är det som saknar kod och därför måste finnas i förväg — stänger,
 * hantlar, bänkar och ställningar.
 */
export const BASELINE: BaselineMachine[] = [
  { name: "Hantlar", muscleGroup: "Helkropp", type: "free" },
  { name: "Skivstång", muscleGroup: "Helkropp", type: "free" },
  { name: "EZ-stång", muscleGroup: "Biceps", type: "free" },
  { name: "Kettlebell", muscleGroup: "Helkropp", type: "free" },
  { name: "Bänk", muscleGroup: "Bröst", type: "free" },
  { name: "Squat Rack", muscleGroup: "Ben", type: "free" },
  { name: "Deadlift Platform", muscleGroup: "Rygg", type: "free", note: "Marklyft" },
  { name: "Dipställning", muscleGroup: "Triceps", type: "bodyweight" },
  { name: "Chinsstång", muscleGroup: "Rygg", type: "bodyweight" },
];

/**
 * Maskiner som låg i baslistan tidigare och ska rensas bort.
 *
 * Behövs för appar som redan hunnit fylla listan. Bara poster utan loggade set
 * tas bort — har man tränat på maskinen är den ens egen, oavsett varifrån den
 * kom från början.
 */
export const RETIRED_BASELINE: string[] = [
  "Chest Press",
  "Incline Chest Press",
  "Decline Chest Press",
  "Pec Deck / Chest Fly",
  "Cable Chest Fly",
  "Smith Machine Bench Press",
  "Plate-loaded Chest Press",
  "Lat Pulldown",
  "Seated Row",
  "Chest-supported Row",
  "High Row",
  "Low Row",
  "Pullover Machine",
  "Rear Delt Machine",
  "Assisted Pull-up",
  "Cable Row",
  "T-bar Row",
  "Shoulder Press",
  "Lateral Raise",
  "Rear Delt Fly",
  "Cable Lateral Raise",
  "Smith Shoulder Press",
  "Leg Extension",
  "Leg Press",
  "Hack Squat",
  "Pendulum Squat",
  "Belt Squat",
  "V-Squat",
  "Seated Leg Curl",
  "Lying Leg Curl",
  "Standing Leg Curl",
  "Hip Thrust Machine",
  "Glute Kickback",
  "Hip Abduction",
  "Hip Adduction",
  "Romanian Deadlift Machine",
  "Glute Drive",
  "Seated Calf Raise",
  "Standing Calf Raise",
  "Calf Press",
  "Biceps Curl Machine",
  "Preacher Curl",
  "Cable Curl",
  "Cable Hammer Curl",
  "Triceps Extension",
  "Triceps Pushdown",
  "Dip Machine",
  "Assisted Dip",
  "Ab Crunch Machine",
  "Cable Crunch",
  "Torso Rotation",
  "Rotary Torso",
  "Back Extension",
  "Roman Chair",
  "Cable Crossover",
  "Functional Trainer",
  "Smith Machine",
  "Power Rack",
  "Half Rack",
  "Adjustable Cable",
  "Löpband",
  "Crosstrainer",
  "Motionscykel",
  "Roddmaskin",
  "Trappmaskin",
];


/** Nyckeln en baslistemaskin får när den inte har någon känd QR-kod. */
export function baselineKey(m: BaselineMachine): string {
  if (m.code) return `lifefitness:s:${m.code}`;
  return `baslista:${m.name.toLowerCase().replace(/[^a-z0-9åäö]+/g, "-")}`;
}

/** Vilka värden som ska loggas, utifrån maskintyp. */
export function baselineMetrics(m: BaselineMachine): Metric[] {
  if (m.type === "cardio") return ["time", "speed", "distance"];
  if (m.type === "bodyweight") return ["reps"];
  if (m.type === "free") return FREE;
  return M;
}
