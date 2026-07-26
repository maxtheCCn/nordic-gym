import {
  formatClock,
  formatDate,
  formatDuration,
  formatMinutes,
  formatNumber,
} from "./format";
import {
  buildStats,
  filterByDays,
  sessionMinutes,
  sessionsWithSets,
  setWeight,
  type Dataset,
} from "./stats";
import type { Gym, Profile, SetEntry } from "./types";

export interface ReportOptions {
  /** Antal dagar bakåt. 0 = hela historiken. */
  days: number;
  /** Ta med varje pass set för set. Utan detta blir rapporten en sammanfattning. */
  includeSessions: boolean;
  /** Fri text från användaren, t.ex. skador eller specifika frågor. */
  extraNotes?: string;
}

/**
 * Bygger en komplett träningsrapport i ren text.
 *
 * Appen analyserar ingenting själv — den strukturerar bara datan och avslutar
 * med en fråga, så att texten kan klistras in i valfri extern AI.
 */
export function buildReport(
  data: Dataset,
  profile: Profile,
  gyms: Gym[],
  options: ReportOptions,
): string {
  const { days, includeSessions, extraNotes } = options;
  const scoped = filterByDays(data, days);
  const stats = buildStats(data, days);
  const gymName = (id: string) =>
    gyms.find((g) => g.id === id)?.name ?? "Okänt gym";
  const machineById = new Map(data.machines.map((m) => [m.id, m]));

  const out: string[] = [];
  const period = days ? `Senaste ${days} dagarna` : "Hela min träningshistorik";

  out.push("Jag tränar på Nordic Wellness.");
  out.push("");

  /* -------------------------------------------------------------- profil */
  if (profile.age) out.push(`Ålder: ${profile.age} år`);
  if (profile.bodyWeight) out.push(`Kroppsvikt: ${formatNumber(profile.bodyWeight)} kg`);
  if (profile.goal) out.push(`Mål: ${profile.goal}`);
  const homeGym = gyms.find((g) => g.id === profile.homeGymId);
  if (homeGym) out.push(`Gym: ${homeGym.name}`);
  if (profile.age || profile.goal || homeGym) out.push("");

  /* --------------------------------------------------------- översikt */
  out.push(`${period.toUpperCase()}`);
  out.push("");
  out.push(`Antal pass: ${stats.sessionCount}`);
  out.push(`Total träningstid: ${formatMinutes(stats.totalMinutes)}`);
  out.push(`Snittlängd per pass: ${formatMinutes(stats.avgMinutes)}`);
  out.push(`Frekvens: ${formatNumber(stats.perWeek)} pass per vecka`);
  out.push(`Totalt antal set: ${stats.totalSets}`);
  out.push(`Totalt antal reps: ${stats.totalReps}`);
  out.push(`Total träningsvolym: ${Math.round(stats.totalVolume).toLocaleString("sv-SE")} kg`);
  if (stats.cardioMinutes > 0) {
    out.push(`Kondition: ${formatMinutes(stats.cardioMinutes)}` +
      (stats.cardioDistanceKm > 0
        ? `, ${formatNumber(stats.cardioDistanceKm)} km`
        : ""));
  }
  if (stats.currentStreakDays > 1) {
    out.push(`Nuvarande svit: ${stats.currentStreakDays} dagar i rad`);
  }
  out.push("");

  /* ---------------------------------------------------------- muskler */
  if (stats.muscleBalance.length) {
    out.push("MUSKELBALANS (antal set)");
    out.push("");
    for (const m of stats.muscleBalance) {
      out.push(`${m.group}: ${m.sets} set`);
    }
    out.push("");
  }

  /* ------------------------------------------------------- utveckling */
  const progressed = stats.progress.filter((p) => p.first !== null);
  if (progressed.length) {
    out.push("STYRKEUTVECKLING");
    out.push("");
    for (const p of progressed) {
      const machine = p.machine;
      const line: string[] = [`${machine.name} (${machine.muscleGroup}):`];
      if (p.first !== null && p.latest !== null) {
        line.push(
          p.first === p.latest
            ? `${formatNumber(p.latest)} kg`
            : `${formatNumber(p.first)} kg → ${formatNumber(p.latest)} kg`,
        );
      }
      if (p.personalBest !== null) {
        line.push(
          `| PB ${formatNumber(p.personalBest)} kg` +
            (p.personalBestReps ? ` × ${p.personalBestReps} reps` : ""),
        );
      }
      line.push(`| ${p.totalSets} set`);
      out.push(line.join(" "));

      // Månad för månad ger AI:n något att se en trend i.
      if (p.points.length > 1) {
        out.push(
          "  " +
            p.points
              .map((pt) => `${pt.label}: ${formatNumber(pt.best)} kg`)
              .join(" | "),
        );
      }
    }
    out.push("");
  }

  /* ------------------------------------------------------------ pass */
  if (includeSessions && scoped.sessions.length) {
    out.push("TRÄNINGSPASS I DETALJ");
    out.push("");
    // Tomma pass utelämnas — de säger inget om träningen och gör bara
    // rapporten svårare att läsa för den som ska analysera den.
    const ordered = sessionsWithSets(scoped.sessions, scoped.sets).sort(
      (a, b) => b.startedAt - a.startedAt,
    );

    for (const session of ordered) {
      const sets = scoped.sets
        .filter((s) => s.sessionId === session.id)
        .sort((a, b) => a.timestamp - b.timestamp);
      if (sets.length === 0) continue;

      out.push(`--- ${formatDate(session.startedAt)} — ${gymName(session.gymId)}`);
      out.push(
        `Start ${formatClock(session.startedAt)}` +
          (session.endedAt
            ? ` | Slut ${formatClock(session.endedAt)} | ${formatMinutes(
                sessionMinutes(session),
              )}`
            : " | pågår"),
      );
      if (session.note) out.push(`Anteckning: ${session.note}`);

      // Gruppera per maskin men behåll ordningen de utfördes i.
      const order: string[] = [];
      const grouped = new Map<string, typeof sets>();
      for (const s of sets) {
        if (!grouped.has(s.machineId)) {
          grouped.set(s.machineId, []);
          order.push(s.machineId);
        }
        grouped.get(s.machineId)!.push(s);
      }

      for (const machineId of order) {
        const machine = machineById.get(machineId);
        const own = grouped.get(machineId)!;
        out.push("");
        out.push(
          `${machine?.name ?? "Okänd maskin"}` +
            (machine ? ` (${machine.muscleGroup})` : "") +
            ` — ${formatClock(own[0].timestamp)}`,
        );
        for (const s of own) {
          out.push(`  ${describeSet(s)}`);
        }
      }
      out.push("");
    }
  }

  /* ------------------------------------------------------- maskinpark */
  if (scoped.machines.length) {
    out.push("MASKINER JAG ANVÄNDER");
    out.push("");
    for (const m of data.machines) {
      // Målet säger vad jag brukar planera, mot vad jag faktiskt gjort ovan.
      const target = m.targetSets ? ` — brukar köra ${m.targetSets} set` : "";
      out.push(`${m.name} — ${m.muscleGroup} — ${gymName(m.gymId)}${target}`);
    }
    out.push("");
  }

  if (extraNotes?.trim()) {
    out.push("EGNA ANTECKNINGAR");
    out.push("");
    out.push(extraNotes.trim());
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push(
    "Analysera min träning och ge förbättringsförslag. Peka särskilt ut " +
      "obalanser mellan muskelgrupper, muskelgrupper jag missar, om volymen " +
      "och frekvensen är rimlig för mitt mål och min ålder, samt vilka vikter " +
      "jag bör sikta på härnäst.",
  );

  return out.join("\n");
}

/** En rad som beskriver ett set, anpassad efter vad maskinen mäter. */
function describeSet(s: SetEntry): string {
  const parts: string[] = [];
  const weight = setWeight(s);
  if (weight > 0) {
    parts.push(
      s.extraWeight
        ? `${formatNumber(s.weight ?? 0)} kg + ${formatNumber(s.extraWeight)} kg = ${formatNumber(weight)} kg`
        : `${formatNumber(weight)} kg`,
    );
  }
  if (s.reps) parts.push(`${s.reps} reps`);
  if (s.durationSec) parts.push(`tid ${formatDuration(s.durationSec)}`);
  if (s.speed) parts.push(`${formatNumber(s.speed)} km/h`);
  if (s.distanceKm) parts.push(`${formatNumber(s.distanceKm)} km`);
  if (s.incline) parts.push(`lutning ${formatNumber(s.incline)}%`);
  if (s.restSec && s.restSec < 900) parts.push(`vila ${formatDuration(s.restSec)}`);
  return `Set ${s.setNumber}: ${parts.join(", ") || "—"}`;
}
