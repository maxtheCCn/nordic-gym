"use client";

import { useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import { PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { buildStats } from "@/lib/stats";
import { useData } from "@/lib/useData";

/**
 * Topplistan — platsen är förberedd, systemet är inte byggt.
 *
 * Den kräver konton på en server, och tills de finns visas i stället vad som
 * faktiskt skulle publiceras: dina egna rekord. Att visa påhittade namn och
 * vikter vore missvisande — det ska gå att se skillnad på en tom funktion och
 * en som redan fungerar.
 */
export default function LeaderboardPage() {
  const { data, loading, error } = useData();

  const records = useMemo(() => {
    const stats = buildStats(
      { machines: data.machines, sessions: data.sessions, sets: data.sets },
      0,
    );
    return stats.progress
      .filter((p) => p.personalBest && p.personalBest > 0)
      .sort((a, b) => (b.personalBest ?? 0) - (a.personalBest ?? 0))
      .slice(0, 8);
  }, [data]);

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-4">
      <PageHeader
        title="Topplista"
        back={false}
        subtitle="Jämför dina rekord med kompisarna"
      />

      <div className="card px-4 py-5 text-center">
        <p className="font-semibold">Inte igång än</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
          Topplistan behöver konton på en server, så att flera personer kan dela
          sina rekord. Tills dess ser du dina egna nedan.
        </p>
      </div>

      <SectionTitle>Så kommer den fungera</SectionTitle>
      <ul className="card divide-y divide-line text-sm">
        <li className="px-4 py-3">
          Du väljer <span className="font-semibold text-white">en gång</span>{" "}
          vilka övningar som ska synas. Resten av loggen förblir privat.
        </li>
        <li className="px-4 py-3">
          Vikterna uppdateras{" "}
          <span className="font-semibold text-white">automatiskt</span> när du
          förbättrar dig — du behöver inte publicera om.
        </li>
        <li className="px-4 py-3">
          Varje övning får en egen lista, tyngsta lyftet först.
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar name={data.profile.name || "Du"} size={36} />
          <span>
            Du syns med visningsnamn och profilbild — eller bara din initial,
            som här.
          </span>
        </li>
      </ul>

      <SectionTitle>Dina rekord</SectionTitle>
      {records.length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Inga rekord än. Logga några set så dyker de upp här.
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {records.map((r) => (
            <li
              key={r.machine.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold leading-tight">
                  {r.machine.name}
                </span>
                <span className="text-xs text-muted">
                  {r.machine.muscleGroup}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold tabular-nums">
                  {formatNumber(r.personalBest!)} kg
                </span>
                {r.personalBestReps && (
                  <span className="text-xs text-muted">
                    × {r.personalBestReps} reps
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
