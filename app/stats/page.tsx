"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChipGroup,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  Spinner,
  Stat,
} from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/format";
import { buildStats } from "@/lib/stats";
import { useData } from "@/lib/useData";

const PERIODS = [30, 90, 365, 0] as const;
const PERIOD_LABELS: Record<number, string> = {
  30: "30 dagar",
  90: "3 mån",
  365: "1 år",
  0: "Allt",
};

export default function StatsPage() {
  const { data, loading, error } = useData();
  const [days, setDays] = useState<number>(30);

  const stats = useMemo(
    () => buildStats({ machines: data.machines, sessions: data.sessions, sets: data.sets }, days),
    [data, days],
  );

  if (loading || error) return <Spinner error={error} />;

  if (data.sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Statistik" back={false} />
        <EmptyState
          title="Ingen statistik än"
          body="Logga några set så börjar appen räkna fram frekvens, muskelbalans och viktutveckling åt dig."
          action={<LinkButton href="/scan" variant="primary">Skanna maskin</LinkButton>}
        />
      </div>
    );
  }

  const maxBalance = Math.max(1, ...stats.muscleBalance.map((m) => m.sets));

  return (
    <div className="pb-4">
      <PageHeader title="Statistik" back={false} />

      <ChipGroup
        options={[...PERIODS]}
        value={days as (typeof PERIODS)[number]}
        onChange={(v) => setDays(v)}
        render={(v) => PERIOD_LABELS[v]}
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          label="Pass"
          value={String(stats.sessionCount)}
          sub={`${formatNumber(stats.perWeek)} per vecka`}
        />
        <Stat
          label="Träningstid"
          value={formatMinutes(stats.totalMinutes)}
          sub={`snitt ${formatMinutes(stats.avgMinutes)}`}
        />
        <Stat
          label="Volym"
          value={`${Math.round(stats.totalVolume).toLocaleString("sv-SE")} kg`}
          sub={`${stats.totalSets} set · ${stats.totalReps} reps`}
        />
        <Stat
          label="Svit"
          value={`${stats.currentStreakDays} d`}
          sub={`längsta ${stats.longestStreakDays} d`}
        />
      </div>

      {stats.cardioMinutes > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Kondition" value={formatMinutes(stats.cardioMinutes)} />
          {/* Distans loggas inte på alla konditionsmaskiner — visa den bara
              när det faktiskt finns något att visa. */}
          {stats.cardioDistanceKm > 0 && (
            <Stat
              label="Distans"
              value={`${formatNumber(stats.cardioDistanceKm)} km`}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------ muskelbalans */}
      <SectionTitle>Muskelbalans</SectionTitle>
      {stats.muscleBalance.length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Inga set i perioden.
        </p>
      ) : (
        <div className="card space-y-2.5 px-4 py-4">
          {stats.muscleBalance.map((m) => (
            <div key={m.group}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{m.group}</span>
                <span className="tabular-nums text-muted">{m.sets} set</span>
              </div>
              {/* En hue för hela serien: stapeln visar mängd, inte identitet. */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(m.sets / maxBalance) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted">
            Jämför antal set per muskelgrupp. Stora skillnader betyder att något
            tränas mycket mer än annat.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------- utveckling */}
      <SectionTitle>Viktutveckling</SectionTitle>
      {stats.progress.filter((p) => p.personalBest).length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Ingen viktdata i perioden.
        </p>
      ) : (
        <div className="space-y-3">
          {stats.progress
            .filter((p) => p.personalBest)
            .map((p) => {
              const maxBest = Math.max(...p.points.map((pt) => pt.best), 1);
              const change =
                p.first !== null && p.latest !== null ? p.latest - p.first : 0;
              return (
                <section key={p.machine.id} className="card px-4 py-3.5">
                  <Link
                    href={`/machine?id=${p.machine.id}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold leading-tight">
                        {p.machine.name}
                      </span>
                      <span className="text-xs text-muted">
                        {p.machine.muscleGroup} · {p.totalSets} set
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums">
                        {formatNumber(p.personalBest!)} kg
                      </span>
                      <span
                        className={`text-xs tabular-nums ${
                          change > 0 ? "text-brand" : "text-muted"
                        }`}
                      >
                        {change > 0 ? `+${formatNumber(change)} kg` : "PB"}
                      </span>
                    </span>
                  </Link>

                  {p.points.length > 1 && (
                    <div className="mt-3 flex items-end gap-1.5">
                      {p.points.map((pt) => (
                        <div key={pt.monthKey} className="flex-1 text-center">
                          <div
                            className="mx-auto w-full rounded-t bg-brand/70"
                            style={{
                              height: `${Math.max(
                                6,
                                (pt.best / maxBest) * 56,
                              )}px`,
                            }}
                          />
                          <p className="mt-1 truncate text-[10px] tabular-nums text-white">
                            {formatNumber(pt.best)}
                          </p>
                          <p className="truncate text-[10px] text-muted">
                            {pt.label.slice(0, 3)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      )}

      <div className="mt-6">
        <LinkButton href="/report" variant="primary" className="w-full">
          Skapa träningsrapport
        </LinkButton>
      </div>
    </div>
  );
}
