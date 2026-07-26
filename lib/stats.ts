import type { Machine, MuscleGroup, Session, SetEntry } from "./types";

export interface Dataset {
  machines: Machine[];
  sessions: Session[];
  sets: SetEntry[];
}

export interface MachineProgress {
  machine: Machine;
  /** Ett värde per månad, i tidsordning. */
  points: { label: string; monthKey: string; best: number; volume: number }[];
  first: number | null;
  latest: number | null;
  /** Tyngsta vikt någonsin (vikt + extra vikt). */
  personalBest: number | null;
  personalBestReps: number | null;
  bestSetVolume: number | null;
  totalSets: number;
}

export interface Stats {
  sessionCount: number;
  totalMinutes: number;
  avgMinutes: number;
  /** Pass per vecka över den valda perioden. */
  perWeek: number;
  totalSets: number;
  totalReps: number;
  /** Summa vikt × reps över alla styrkeset, i kg. */
  totalVolume: number;
  muscleBalance: { group: MuscleGroup; sets: number; volume: number }[];
  progress: MachineProgress[];
  cardioMinutes: number;
  cardioDistanceKm: number;
  longestStreakDays: number;
  currentStreakDays: number;
}

/** Total vikt för ett set: stackvikt + eventuell extra platta. */
export function setWeight(s: SetEntry): number {
  return (s.weight ?? 0) + (s.extraWeight ?? 0);
}

/** Vikt × reps. Kondition ger 0 eftersom volym inte är meningsfullt där. */
export function setVolume(s: SetEntry): number {
  const w = setWeight(s);
  if (!w || !s.reps) return 0;
  return w * s.reps;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ts: number): string {
  const label = new Date(ts).toLocaleDateString("sv-SE", { month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Passlängd i minuter. Pågående pass räknas fram till nu. */
export function sessionMinutes(session: Session): number {
  const end = session.endedAt ?? Date.now();
  return Math.max(0, (end - session.startedAt) / 60_000);
}

/**
 * Filtrerar datan till de senaste `days` dygnen.
 * `days = 0` betyder "hela historiken".
 */
export function filterByDays(data: Dataset, days: number): Dataset {
  if (!days) return data;
  const cutoff = Date.now() - days * 86_400_000;
  const sessions = data.sessions.filter((s) => s.startedAt >= cutoff);
  const ids = new Set(sessions.map((s) => s.id));
  return {
    machines: data.machines,
    sessions,
    sets: data.sets.filter((s) => ids.has(s.sessionId)),
  };
}

function streaks(sessions: Session[]): { longest: number; current: number } {
  if (sessions.length === 0) return { longest: 0, current: 0 };
  const dayOf = (ts: number) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = [...new Set(sessions.map((s) => dayOf(s.startedAt)))].sort(
    (a, b) => a - b,
  );

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] - days[i - 1] === 86_400_000 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Nuvarande streak räknas bara om det finns ett pass idag eller igår.
  const today = dayOf(Date.now());
  const last = days[days.length - 1];
  let current = 0;
  if (today - last <= 86_400_000) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (days[i] - days[i - 1] === 86_400_000) current++;
      else break;
    }
  }
  return { longest, current };
}

/**
 * Sållar bort pass utan innehåll.
 *
 * Raderar man sitt enda set blir passet kvar som ett tomt skal. Det räknades
 * som ett fullvärdigt träningspass och drog ner både snittlängd och frekvens
 * — ett pass man aldrig genomförde ska inte påverka statistiken.
 *
 * Pågående pass behålls oavsett, annars försvinner "Pågående pass" från
 * startsidan i samma sekund som man ångrar sitt första set.
 */
export function sessionsWithSets(
  sessions: Session[],
  sets: SetEntry[],
): Session[] {
  const used = new Set(sets.map((s) => s.sessionId));
  return sessions.filter((s) => used.has(s.id) || s.endedAt === null);
}

export function buildStats(data: Dataset, days: number): Stats {
  const scoped = filterByDays(data, days);
  const { sets, machines } = scoped;
  const sessions = sessionsWithSets(scoped.sessions, scoped.sets);
  const machineById = new Map(machines.map((m) => [m.id, m]));

  const totalMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);

  // Frekvens mäts över den faktiskt loggade perioden, inte hela fönstret —
  // annars ser en ny användare alltid ut att träna nästan aldrig.
  let spanDays = days;
  if (!spanDays) {
    if (sessions.length > 1) {
      const first = Math.min(...sessions.map((s) => s.startedAt));
      spanDays = Math.max(7, (Date.now() - first) / 86_400_000);
    } else {
      spanDays = 7;
    }
  }
  const perWeek = sessions.length / (spanDays / 7);

  const balance = new Map<MuscleGroup, { sets: number; volume: number }>();
  let totalReps = 0;
  let totalVolume = 0;
  let cardioSeconds = 0;
  let cardioDistanceKm = 0;

  for (const s of sets) {
    const machine = machineById.get(s.machineId);
    totalReps += s.reps ?? 0;
    totalVolume += setVolume(s);
    cardioSeconds += s.durationSec ?? 0;
    cardioDistanceKm += s.distanceKm ?? 0;
    if (!machine) continue;
    const entry = balance.get(machine.muscleGroup) ?? { sets: 0, volume: 0 };
    entry.sets += 1;
    entry.volume += setVolume(s);
    balance.set(machine.muscleGroup, entry);
  }

  const muscleBalance = [...balance.entries()]
    .map(([group, v]) => ({ group, ...v }))
    .sort((a, b) => b.sets - a.sets);

  const progress: MachineProgress[] = [];
  for (const machine of machines) {
    const own = sets
      .filter((s) => s.machineId === machine.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (own.length === 0) continue;

    const months = new Map<
      string,
      { label: string; best: number; volume: number }
    >();
    for (const s of own) {
      const key = monthKey(s.timestamp);
      const current = months.get(key) ?? {
        label: monthLabel(s.timestamp),
        best: 0,
        volume: 0,
      };
      current.best = Math.max(current.best, setWeight(s));
      current.volume += setVolume(s);
      months.set(key, current);
    }
    const points = [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, v]) => ({ monthKey, ...v }));

    /*
     * Utvecklingen jämför bästa vikt per pass, inte första setet mot sista.
     *
     * Nästan alla drar av extraplattan på sista setet när orken tryter. Med
     * råa första och sista set såg det ut som en tillbakagång — "30,75 → 27
     * kg" — trots att passet var precis som planerat. Bästa vikt per pass är
     * det som faktiskt säger något om utveckling.
     */
    const perSession = new Map<string, number>();
    for (const s of own) {
      const best = perSession.get(s.sessionId) ?? 0;
      perSession.set(s.sessionId, Math.max(best, setWeight(s)));
    }
    const sessionBests = [...perSession.values()].filter((w) => w > 0);

    const weights = own.map(setWeight).filter((w) => w > 0);
    const bestSet = own.reduce(
      (best, s) => (setWeight(s) > setWeight(best) ? s : best),
      own[0],
    );

    progress.push({
      machine,
      points,
      first: sessionBests.length ? sessionBests[0] : null,
      latest: sessionBests.length ? sessionBests[sessionBests.length - 1] : null,
      personalBest: weights.length ? Math.max(...weights) : null,
      personalBestReps: weights.length ? (bestSet.reps ?? null) : null,
      bestSetVolume: own.length ? Math.max(...own.map(setVolume)) : null,
      totalSets: own.length,
    });
  }
  progress.sort((a, b) => b.totalSets - a.totalSets);

  const { longest, current } = streaks(sessions);

  return {
    sessionCount: sessions.length,
    totalMinutes,
    avgMinutes: sessions.length ? totalMinutes / sessions.length : 0,
    perWeek,
    totalSets: sets.length,
    totalReps,
    totalVolume,
    muscleBalance,
    progress,
    cardioMinutes: cardioSeconds / 60,
    cardioDistanceKm,
    longestStreakDays: longest,
    currentStreakDays: current,
  };
}

/**
 * Senaste setet på en maskin — det som visas som "Senaste" på loggningssidan
 * och som förifyller formuläret.
 */
export function lastSetFor(
  sets: SetEntry[],
  machineId: string,
): SetEntry | undefined {
  return sets
    .filter((s) => s.machineId === machineId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
}
