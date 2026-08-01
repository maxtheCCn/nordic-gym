"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  PageHeader,
  SectionTitle,
  Spinner,
  Stat,
} from "@/components/ui";
import { deleteSession, endSession } from "@/lib/db";
import {
  formatClock,
  formatDate,
  formatDuration,
  formatMinutes,
  formatNumber,
} from "@/lib/format";
import { sessionMinutes, setVolume, setWeight } from "@/lib/stats";
import { useData } from "@/lib/useData";
import type { SetEntry } from "@/lib/types";

export default function SessionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SessionDetail />
    </Suspense>
  );
}

function SessionDetail() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { data, loading, error, reload } = useData();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = data.sessions.find((s) => s.id === id);
  const gym = data.gyms.find((g) => g.id === session?.gymId);
  const machineById = useMemo(
    () => new Map(data.machines.map((m) => [m.id, m])),
    [data.machines],
  );

  /**
   * Muskelbalans för just det här passet.
   *
   * Samma vy som på statistiksidan men avgränsad till ett pass — det är där
   * man ser om dagen blev sned, medan det fortfarande går att göra något åt
   * det nästa gång.
   */
  const balance = useMemo(() => {
    if (!session) return [];
    const own = data.sets.filter((s) => s.sessionId === session.id);
    const totals = new Map<string, { sets: number; volume: number }>();
    for (const s of own) {
      const group = machineById.get(s.machineId)?.muscleGroup;
      if (!group) continue;
      const entry = totals.get(group) ?? { sets: 0, volume: 0 };
      entry.sets += 1;
      entry.volume += setVolume(s);
      totals.set(group, entry);
    }
    return [...totals.entries()]
      .map(([group, v]) => ({ group, ...v }))
      .sort((a, b) => b.sets - a.sets);
  }, [session, data.sets, machineById]);

  /** Set grupperade per maskin, i den ordning maskinerna användes. */
  const exercises = useMemo(() => {
    if (!session) return [];
    const own = data.sets
      .filter((s) => s.sessionId === session.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    const order: string[] = [];
    const grouped = new Map<string, SetEntry[]>();
    for (const s of own) {
      if (!grouped.has(s.machineId)) {
        grouped.set(s.machineId, []);
        order.push(s.machineId);
      }
      grouped.get(s.machineId)!.push(s);
    }
    return order.map((machineId) => ({
      machine: machineById.get(machineId),
      machineId,
      sets: grouped.get(machineId)!,
    }));
  }, [session, data.sets, machineById]);

  if (loading || error) return <Spinner error={error} />;
  if (!session) {
    return (
      <div>
        <PageHeader title="Passet hittades inte" />
        <EmptyState title="Borta" body="Passet finns inte längre i din logg." />
      </div>
    );
  }

  const allSets = exercises.flatMap((e) => e.sets);
  const volume = allSets.reduce((sum, s) => sum + setVolume(s), 0);
  const reps = allSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const cardioSec = allSets.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

  /** Vila mellan set inom passet, för att se om tempot var jämnt. */
  const rests = allSets
    .map((s) => s.restSec)
    .filter((r): r is number => typeof r === "number" && r > 0 && r < 900);
  const avgRest = rests.length
    ? rests.reduce((a, b) => a + b, 0) / rests.length
    : 0;

  return (
    <div className="pb-6">
      <PageHeader
        title={formatDate(session.startedAt)}
        subtitle={gym?.name ?? "Okänt gym"}
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Tid"
          value={formatMinutes(sessionMinutes(session))}
          sub={`${formatClock(session.startedAt)}–${
            session.endedAt ? formatClock(session.endedAt) : "pågår"
          }`}
        />
        <Stat label="Set" value={String(allSets.length)} sub={`${exercises.length} övningar`} />
        <Stat
          label="Volym"
          value={`${Math.round(volume).toLocaleString("sv-SE")}`}
          sub="kg totalt"
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Stat label="Reps" value={String(reps)} sub="totalt" />
        <Stat
          label="Snittvila"
          value={avgRest ? formatDuration(avgRest) : "—"}
          sub="mellan set"
        />
        <Stat
          label="Kondition"
          value={cardioSec ? formatDuration(cardioSec) : "—"}
          sub={cardioSec ? "totalt" : "inget loggat"}
        />
      </div>

      {balance.length > 0 && (
        <>
          <SectionTitle>Muskelbalans i passet</SectionTitle>
          <div className="card space-y-2.5 px-4 py-4">
            {balance.map((m) => (
              <div key={m.group}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{m.group}</span>
                  <span className="tabular-nums text-muted">
                    {m.sets} set
                    {m.volume > 0 &&
                      ` · ${Math.round(m.volume).toLocaleString("sv-SE")} kg`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${(m.sets / Math.max(...balance.map((b) => b.sets))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {session.endedAt === null && (
        <Button
          className="mt-3 w-full"
          onClick={async () => {
            await endSession(session.id);
            await reload();
          }}
        >
          Avsluta passet
        </Button>
      )}

      <SectionTitle>Övningar</SectionTitle>
      {exercises.length === 0 ? (
        <EmptyState
          title="Inga set loggade"
          body="Det här passet innehåller inga set än."
        />
      ) : (
        <div className="space-y-3">
          {exercises.map(({ machine, machineId, sets }) => (
            <section key={machineId} className="card overflow-hidden">
              <Link
                href={`/machine?id=${machineId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold leading-tight">
                    {machine?.name ?? "Okänd maskin"}
                  </span>
                  <span className="text-xs text-muted">
                    {machine?.muscleGroup ?? "—"} · {formatClock(sets[0].timestamp)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {sets.length} set
                </span>
              </Link>
              <ul className="divide-y divide-line border-t border-line">
                {sets.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="w-10 shrink-0 text-xs font-semibold text-muted">
                      Set {s.setNumber}
                    </span>
                    <span className="flex-1 font-semibold tabular-nums">
                      {describeSet(s)}
                    </span>
                    {s.restSec !== undefined && s.restSec < 900 && (
                      <span className="shrink-0 text-xs text-muted">
                        vila {formatDuration(s.restSec)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <SectionTitle>Hantera</SectionTitle>
      {confirmDelete ? (
        <div className="card p-4">
          <p className="text-sm text-muted">
            Passet och dess {allSets.length} set tas bort permanent.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={async () => {
                await deleteSession(session.id);
                router.replace("/history");
              }}
            >
              Ja, ta bort
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmDelete(false)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="danger"
          className="w-full"
          onClick={() => setConfirmDelete(true)}
        >
          Ta bort passet
        </Button>
      )}
    </div>
  );
}

function describeSet(s: SetEntry): string {
  const parts: string[] = [];
  const weight = setWeight(s);
  if (weight > 0) {
    parts.push(
      s.extraWeight
        ? `${formatNumber(s.weight ?? 0)} + ${formatNumber(s.extraWeight)} kg`
        : `${formatNumber(weight)} kg`,
    );
  }
  if (s.reps) parts.push(`${s.reps} reps`);
  if (s.durationSec) parts.push(formatDuration(s.durationSec));
  if (s.speed) parts.push(`${formatNumber(s.speed)} km/h`);
  if (s.distanceKm) parts.push(`${formatNumber(s.distanceKm)} km`);
  if (s.incline) parts.push(`${formatNumber(s.incline)}%`);
  return parts.join(" · ") || "—";
}
