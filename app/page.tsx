"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { EmptyState, LinkButton, SectionTitle, Spinner } from "@/components/ui";
import { endSession } from "@/lib/db";
import { formatClock, formatDuration, formatNumber, relativeDay } from "@/lib/format";
import { setWeight } from "@/lib/stats";
import { useData, useTicker } from "@/lib/useData";
import type { Machine, SetEntry } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { data, loading, error, reload } = useData();
  const { activeSession, machines, sets, sessions, gyms } = data;

  // Passtimern ska räkna upp i realtid medan man tränar.
  useTicker(Boolean(activeSession));

  const machineById = useMemo(
    () => new Map(machines.map((m) => [m.id, m])),
    [machines],
  );

  const activeSets = useMemo(
    () =>
      activeSession
        ? sets.filter((s) => s.sessionId === activeSession.id)
        : [],
    [sets, activeSession],
  );

  /** Maskiner man använt nyligen — snabbväg in utan att skanna om. */
  const recentMachines = useMemo(() => {
    const lastUsed = new Map<string, number>();
    for (const s of sets) {
      const prev = lastUsed.get(s.machineId) ?? 0;
      if (s.timestamp > prev) lastUsed.set(s.machineId, s.timestamp);
    }
    return [...lastUsed.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => machineById.get(id))
      .filter((m): m is Machine => Boolean(m));
  }, [sets, machineById]);

  const recentSets = useMemo(
    () => [...sets].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [sets],
  );

  const activeGym = gyms.find((g) => g.id === activeSession?.gymId);
  const lastSession = sessions.find((s) => s.endedAt !== null);

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-4">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Nordic Wellness
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Träningslogg</h1>
        </div>
        <Link
          href="/stats"
          aria-label="Statistik"
          className="tap flex w-11 items-center justify-center rounded-xl border border-line bg-surface text-muted active:bg-surface-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </Link>
      </header>

      {/* Skanna-knappen är sidans tyngdpunkt — den är det man kommer hit för. */}
      <Link
        href="/scan"
        className="flex w-full items-center gap-4 rounded-2xl bg-brand px-5 py-6 text-ink active:bg-brand-dim"
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M7 12h10" />
        </svg>
        <span>
          <span className="block text-2xl font-extrabold leading-tight">
            Skanna maskin
          </span>
          <span className="block text-sm font-medium opacity-80">
            {machines.length === 0
              ? "Börja din Nordic Wellness-runda"
              : machines.length === 1
                ? "1 maskin sparad"
                : `${machines.length} maskiner sparade`}
          </span>
        </span>
      </Link>

      {/* Alla maskiner har inte QR-kod — löpband, bänkar och fria vikter
          måste gå att nå utan att skanna. */}
      <Link
        href="/machines"
        className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3.5 font-semibold active:bg-surface-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        Välj maskin i listan
      </Link>

      {/* ------------------------------------------------------ aktivt pass */}
      {activeSession ? (
        <section className="card mt-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                Pågående pass
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums leading-none">
                {formatDuration((Date.now() - activeSession.startedAt) / 1000)}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                {activeGym?.name ?? "Okänt gym"} · start{" "}
                {formatClock(activeSession.startedAt)} · {activeSets.length} set
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await endSession(activeSession.id);
                await reload();
              }}
              className="tap shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold active:bg-line"
            >
              Avsluta
            </button>
          </div>
          <Link
            href={`/session?id=${activeSession.id}`}
            className="mt-3 block text-sm font-semibold text-brand"
          >
            Visa passet →
          </Link>
        </section>
      ) : (
        lastSession && (
          <p className="mt-4 text-center text-sm text-muted">
            Senaste passet: {relativeDay(lastSession.startedAt)}
          </p>
        )
      )}

      {/* --------------------------------------------------- senaste övningar */}
      {recentMachines.length > 0 && (
        <>
          <SectionTitle>Senaste övningar</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {recentMachines.map((machine) => (
              <button
                key={machine.id}
                type="button"
                onClick={() => router.push(`/machine?id=${machine.id}`)}
                className="card px-3.5 py-3 text-left active:bg-surface-2"
              >
                <p className="truncate font-semibold leading-tight">
                  {machine.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {machine.muscleGroup}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ------------------------------------------------ senaste resultat */}
      <SectionTitle>Senaste resultat</SectionTitle>
      {recentSets.length === 0 ? (
        <EmptyState
          title="Inget loggat än"
          body="Skanna en maskin på gymmet så registrerar appen den automatiskt. Nästa gång du skannar samma kod öppnas rätt sida direkt."
          action={<LinkButton href="/scan" variant="primary">Skanna maskin</LinkButton>}
        />
      ) : (
        <ul className="card divide-y divide-line">
          {recentSets.map((s) => (
            <li key={s.id}>
              <Link
                href={`/machine?id=${s.machineId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold leading-tight">
                    {machineById.get(s.machineId)?.name ?? "Okänd maskin"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {relativeDay(s.timestamp)} · {formatClock(s.timestamp)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold tabular-nums">
                    {describeResult(s)}
                  </span>
                  <span className="text-xs text-muted">Set {s.setNumber}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Kort sammanfattning av ett set — anpassad efter styrka eller kondition. */
function describeResult(s: SetEntry): string {
  const weight = setWeight(s);
  if (weight > 0) {
    return `${formatNumber(weight)} kg${s.reps ? ` × ${s.reps}` : ""}`;
  }
  if (s.durationSec) {
    return formatDuration(s.durationSec) + (s.speed ? ` · ${formatNumber(s.speed)} km/h` : "");
  }
  return s.reps ? `${s.reps} reps` : "—";
}
