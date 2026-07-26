"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyState, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { formatClock, formatDate, formatMinutes } from "@/lib/format";
import { sessionMinutes } from "@/lib/stats";
import { useData } from "@/lib/useData";

export default function HistoryPage() {
  const { data, loading, error } = useData();
  const { sessions, sets, machines, gyms } = data;

  const machineById = useMemo(
    () => new Map(machines.map((m) => [m.id, m])),
    [machines],
  );

  /** Passen grupperade per månad, nyast först. */
  const months = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const d = new Date(session.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(session);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-4">
      <PageHeader
        title="Historik"
        back={false}
        subtitle={
          sessions.length
            ? `${sessions.length} pass · ${sets.length} set totalt`
            : undefined
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="Ingen historik än"
          body="När du sparar ditt första set startas ett pass automatiskt. Passet hamnar här när det är avslutat."
          action={<LinkButton href="/scan" variant="primary">Skanna maskin</LinkButton>}
        />
      ) : (
        months.map(([key, monthSessions]) => (
          <section key={key} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              {monthTitle(monthSessions[0].startedAt)}
            </h2>
            <ul className="card divide-y divide-line">
              {monthSessions.map((session) => {
                const own = sets.filter((s) => s.sessionId === session.id);
                const groups = [
                  ...new Set(
                    own
                      .map((s) => machineById.get(s.machineId)?.muscleGroup)
                      .filter(Boolean),
                  ),
                ];
                return (
                  <li key={session.id}>
                    <Link
                      href={`/session?id=${session.id}`}
                      className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold leading-tight">
                            {formatDate(session.startedAt)}
                          </span>
                          {session.endedAt === null && (
                            <span className="shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                              Pågår
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {gyms.find((g) => g.id === session.gymId)?.name ??
                            "Okänt gym"}{" "}
                          · {formatClock(session.startedAt)}
                          {groups.length > 0 && ` · ${groups.join(", ")}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold tabular-nums">
                          {formatMinutes(sessionMinutes(session))}
                        </span>
                        <span className="text-xs text-muted">
                          {own.length} set
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function monthTitle(ts: number): string {
  const label = new Date(ts).toLocaleDateString("sv-SE", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
