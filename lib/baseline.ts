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

export const BASELINE: BaselineMachine[] = [
  // ------------------------------------------------------------------ bröst
  { name: "Chest Press", muscleGroup: "Bröst", type: "strength", code: "sscp" },
  { name: "Incline Chest Press", muscleGroup: "Bröst", type: "strength", note: "Övre bröst" },
  { name: "Decline Chest Press", muscleGroup: "Bröst", type: "strength", note: "Nedre bröst" },
  { name: "Pec Deck / Chest Fly", muscleGroup: "Bröst", type: "strength" },
  { name: "Cable Chest Fly", muscleGroup: "Bröst", type: "strength" },
  { name: "Smith Machine Bench Press", muscleGroup: "Bröst", type: "free" },
  { name: "Plate-loaded Chest Press", muscleGroup: "Bröst", type: "free" },
  { name: "Bänk", muscleGroup: "Bröst", type: "free", note: "Fria vikter" },

  // ------------------------------------------------------------------- rygg
  { name: "Lat Pulldown", muscleGroup: "Rygg", type: "strength", code: "sspd" },
  { name: "Seated Row", muscleGroup: "Rygg", type: "strength", code: "ssrw" },
  { name: "Chest-supported Row", muscleGroup: "Rygg", type: "strength" },
  { name: "High Row", muscleGroup: "Rygg", type: "strength" },
  { name: "Low Row", muscleGroup: "Rygg", type: "strength" },
  { name: "Pullover Machine", muscleGroup: "Rygg", type: "strength" },
  { name: "Rear Delt Machine", muscleGroup: "Rygg", type: "strength", note: "Bakre axel" },
  { name: "Assisted Pull-up", muscleGroup: "Rygg", type: "strength", note: "Vikten är avlastning" },
  { name: "Cable Row", muscleGroup: "Rygg", type: "strength" },
  { name: "T-bar Row", muscleGroup: "Rygg", type: "free" },
  { name: "Deadlift Platform", muscleGroup: "Rygg", type: "free", note: "Marklyft" },
  { name: "Chinsstång", muscleGroup: "Rygg", type: "bodyweight" },

  // ------------------------------------------------------------------ axlar
  { name: "Shoulder Press", muscleGroup: "Axlar", type: "strength", code: "sssp" },
  { name: "Lateral Raise", muscleGroup: "Axlar", type: "strength" },
  { name: "Rear Delt Fly", muscleGroup: "Axlar", type: "strength" },
  { name: "Cable Lateral Raise", muscleGroup: "Axlar", type: "strength" },
  { name: "Smith Shoulder Press", muscleGroup: "Axlar", type: "free" },

  // -------------------------------------------------------- ben, framsida lår
  { name: "Leg Extension", muscleGroup: "Ben", type: "strength", code: "ssle" },
  { name: "Leg Press", muscleGroup: "Ben", type: "strength" },
  { name: "Hack Squat", muscleGroup: "Ben", type: "free" },
  { name: "Pendulum Squat", muscleGroup: "Ben", type: "free" },
  { name: "Belt Squat", muscleGroup: "Ben", type: "strength" },
  { name: "V-Squat", muscleGroup: "Ben", type: "free" },
  { name: "Squat Rack", muscleGroup: "Ben", type: "free" },

  // ------------------------------------------------- ben, baksida lår och säte
  { name: "Seated Leg Curl", muscleGroup: "Ben", type: "strength", code: "ssslc" },
  { name: "Lying Leg Curl", muscleGroup: "Ben", type: "strength" },
  { name: "Standing Leg Curl", muscleGroup: "Ben", type: "strength" },
  { name: "Hip Thrust Machine", muscleGroup: "Ben", type: "strength", note: "Säte" },
  { name: "Glute Kickback", muscleGroup: "Ben", type: "strength", note: "Säte" },
  { name: "Hip Abduction", muscleGroup: "Ben", type: "strength", note: "Utsida höft" },
  { name: "Hip Adduction", muscleGroup: "Ben", type: "strength", note: "Insida lår" },
  { name: "Romanian Deadlift Machine", muscleGroup: "Ben", type: "strength" },
  { name: "Glute Drive", muscleGroup: "Ben", type: "strength", note: "Säte" },

  // ------------------------------------------------------------------ vader
  { name: "Seated Calf Raise", muscleGroup: "Vader", type: "strength" },
  { name: "Standing Calf Raise", muscleGroup: "Vader", type: "strength" },
  { name: "Calf Press", muscleGroup: "Vader", type: "strength" },

  // ----------------------------------------------------------------- biceps
  { name: "Biceps Curl Machine", muscleGroup: "Biceps", type: "strength", code: "ssbcd" },
  { name: "Preacher Curl", muscleGroup: "Biceps", type: "free" },
  { name: "Cable Curl", muscleGroup: "Biceps", type: "strength" },
  { name: "Cable Hammer Curl", muscleGroup: "Biceps", type: "strength" },
  { name: "EZ-stång", muscleGroup: "Biceps", type: "free" },

  // ---------------------------------------------------------------- triceps
  { name: "Triceps Extension", muscleGroup: "Triceps", type: "strength", code: "sste" },
  { name: "Triceps Pushdown", muscleGroup: "Triceps", type: "strength" },
  { name: "Dip Machine", muscleGroup: "Triceps", type: "strength" },
  { name: "Assisted Dip", muscleGroup: "Triceps", type: "strength", note: "Vikten är avlastning" },
  { name: "Dipställning", muscleGroup: "Triceps", type: "bodyweight" },

  // ------------------------------------------------------------------- mage
  { name: "Ab Crunch Machine", muscleGroup: "Mage", type: "strength", code: "ssab" },
  { name: "Cable Crunch", muscleGroup: "Mage", type: "strength" },
  { name: "Torso Rotation", muscleGroup: "Mage", type: "strength", code: "sstr" },
  { name: "Rotary Torso", muscleGroup: "Mage", type: "strength" },
  { name: "Back Extension", muscleGroup: "Mage", type: "bodyweight", note: "Ländrygg och säte" },
  { name: "Roman Chair", muscleGroup: "Mage", type: "bodyweight" },

  // -------------------------------------------------------------- helkropp
  { name: "Cable Crossover", muscleGroup: "Helkropp", type: "strength" },
  { name: "Functional Trainer", muscleGroup: "Helkropp", type: "strength" },
  { name: "Smith Machine", muscleGroup: "Helkropp", type: "free" },
  { name: "Power Rack", muscleGroup: "Helkropp", type: "free" },
  { name: "Half Rack", muscleGroup: "Helkropp", type: "free" },
  { name: "Adjustable Cable", muscleGroup: "Helkropp", type: "strength" },
  { name: "Hantlar", muscleGroup: "Helkropp", type: "free" },
  { name: "Skivstång", muscleGroup: "Helkropp", type: "free" },
  { name: "Kettlebell", muscleGroup: "Helkropp", type: "free" },

  // -------------------------------------------------------------- kondition
  { name: "Löpband", muscleGroup: "Kondition", type: "cardio" },
  { name: "Crosstrainer", muscleGroup: "Kondition", type: "cardio" },
  { name: "Motionscykel", muscleGroup: "Kondition", type: "cardio" },
  { name: "Roddmaskin", muscleGroup: "Kondition", type: "cardio" },
  { name: "Trappmaskin", muscleGroup: "Kondition", type: "cardio" },
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
