"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { Spinner } from "@/components/ui";
import { endSession } from "@/lib/db";
import { formatClock, formatDuration } from "@/lib/format";
import { useData, useTicker } from "@/lib/useData";

/**
 * Startsidan.
 *
 * Medvetet kort. Det man kommer hit för är att börja träna, och allt som inte
 * hör till den resan är flyttat till egna sidor: skanna, välj maskin, se
 * översikten. Historik och statistik nås från fliklisten längst ner.
 */
export default function HomePage() {
  const { data, loading, error, reload } = useData();
  const { activeSession, machines, sets, sessions, gyms } = data;

  // Passtimern ska räkna upp i realtid medan man tränar.
  useTicker(Boolean(activeSession));

  const activeSets = useMemo(
    () =>
      activeSession ? sets.filter((s) => s.sessionId === activeSession.id) : [],
    [sets, activeSession],
  );

  const activeGym = gyms.find((g) => g.id === activeSession?.gymId);

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-4">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          Nordic Wellness
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Träningslogg</h1>
      </header>

      {/*
        De tre delarna av startsidan, med samma avstånd mellan sig: skanna,
        välj i listan, se översikten. Kalendern ska kännas som en tredje
        likvärdig del — inte som något man skrollar ner till.
      */}
      <div className="space-y-3">
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

        {/* Allt har inte en QR-kod — löpband, bänkar och fria vikter. */}
        <Link
          href="/machines"
          className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3.5 font-semibold active:bg-surface-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          Välj maskin i listan
        </Link>

        {/* Bara synligt under ett pass — då är det det viktigaste på sidan. */}
        {activeSession && (
          <section className="card p-4">
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
        )}

        {sessions.length > 0 && (
          <TrainingCalendar sessions={sessions} sets={sets} />
        )}
      </div>

      {/* Två jämnstora genvägar, utanför själva träningsresan. */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/supplements"
          className="card flex flex-col items-center gap-1.5 px-3 py-4 font-semibold active:bg-surface-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z" />
            <path d="M8.5 8.5l7 7" />
          </svg>
          Tillskott
        </Link>
        <Link
          href="/settings"
          className="card flex flex-col items-center gap-1.5 px-3 py-4 font-semibold active:bg-surface-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.5.55.87 1.06.99H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Inställningar
        </Link>
      </div>
    </div>
  );
}
