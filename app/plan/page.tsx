"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  PageHeader,
  SectionTitle,
  Spinner,
  TextArea,
} from "@/components/ui";
import { deletePlan, importPlans, listPlans } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { useData } from "@/lib/useData";
import type { Plan, PlanExercise } from "@/lib/types";

/**
 * Rekommenderade pass.
 *
 * Appen räknar inte ut något själv — precis som med rapporten. Planen skrivs
 * utanför appen utifrån en träningsrapport och klistras in här, varefter appen
 * lagrar den och visar den vid maskinen. Analysen bor kvar utanför, appen
 * förblir en logg.
 */
export default function PlanPage() {
  const { data, loading, error } = useData();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPlans(await listPlans());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Vilka maskiner som redan körts i det pågående passet. */
  const doneToday = useMemo(() => {
    if (!data.activeSession) return new Set<string>();
    return new Set(
      data.sets
        .filter((s) => s.sessionId === data.activeSession!.id)
        .map((s) => s.machineId),
    );
  }, [data.sets, data.activeSession]);

  const machineByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data.machines) map.set(m.name.trim().toLowerCase(), m.id);
    return map;
  }, [data.machines]);

  async function handleImport() {
    setImportError(null);
    setStatus(null);
    try {
      const count = await importPlans(JSON.parse(paste));
      await refresh();
      setPaste("");
      setShowPaste(false);
      setStatus(count === 1 ? "1 pass tillagt." : `${count} pass tillagda.`);
    } catch (e) {
      setImportError(
        e instanceof SyntaxError
          ? "Texten kunde inte läsas. Kopiera hela blocket, från { till }."
          : e instanceof Error
            ? e.message
            : "Kunde inte läsa passet.",
      );
    }
  }

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-6">
      <PageHeader
        title="Rekommenderat pass"
        subtitle="Följ passet övning för övning — tryck på en rad för att logga"
      />

      {plans.length === 0 && !showPaste && (
        <EmptyState
          title="Inget pass än"
          body="Skicka din träningsrapport så får du tillbaka ett pass att klistra in här, med övningar och målvikter."
          action={
            <Button onClick={() => setShowPaste(true)}>Klistra in pass</Button>
          }
        />
      )}

      {status && (
        <p className="card mb-4 px-4 py-3 text-sm text-brand">{status}</p>
      )}

      {plans.map((plan) => (
        <section key={plan.id} className="mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold leading-tight">{plan.name}</h2>
            <button
              type="button"
              onClick={async () => {
                await deletePlan(plan.id);
                await refresh();
              }}
              className="shrink-0 text-xs text-muted underline"
            >
              Ta bort
            </button>
          </div>

          {plan.note && (
            <p className="mb-3 text-sm text-muted">{plan.note}</p>
          )}

          <ul className="card divide-y divide-line">
            {plan.exercises.map((exercise, i) => (
              <ExerciseRow
                key={i}
                exercise={exercise}
                machineId={machineByName.get(exercise.machine.trim().toLowerCase())}
                done={
                  !!machineByName.get(exercise.machine.trim().toLowerCase()) &&
                  doneToday.has(
                    machineByName.get(exercise.machine.trim().toLowerCase())!,
                  )
                }
              />
            ))}
          </ul>
        </section>
      ))}

      {showPaste ? (
        <>
          <SectionTitle>Klistra in pass</SectionTitle>
          <TextArea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder='{"format":"nw-plan","plans":[…]}'
            className="min-h-40 font-mono text-xs"
          />
          {importError && (
            <p className="mt-2 text-sm text-warn">{importError}</p>
          )}
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" onClick={handleImport} disabled={!paste.trim()}>
              Lägg till
            </Button>
            <Button variant="secondary" onClick={() => setShowPaste(false)}>
              Avbryt
            </Button>
          </div>
        </>
      ) : (
        plans.length > 0 && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowPaste(true)}
          >
            Klistra in nytt pass
          </Button>
        )
      )}

      <p className="mt-5 text-xs text-muted">
        Appen analyserar ingenting själv. Passen skrivs utifrån din
        träningsrapport och klistras in här — precis som rapporten går ut.
      </p>

      <div className="mt-3">
        <Link href="/report" className="text-sm font-semibold text-brand">
          Skapa träningsrapport →
        </Link>
      </div>
    </div>
  );
}

function ExerciseRow({
  exercise,
  machineId,
  done,
}: {
  exercise: PlanExercise;
  machineId?: string;
  done: boolean;
}) {
  const target = [
    exercise.sets && exercise.reps
      ? `${exercise.sets} × ${exercise.reps}`
      : exercise.sets
        ? `${exercise.sets} set`
        : null,
    exercise.weight ? `${formatNumber(exercise.weight)} kg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold leading-tight">
            {exercise.machine}
          </span>
          {done && <span className="shrink-0 text-sm text-brand">✓</span>}
        </span>
        {target && (
          <span className="mt-0.5 block text-sm tabular-nums text-muted">
            {target}
          </span>
        )}
        {exercise.note && (
          <span className="mt-0.5 block text-xs text-muted">{exercise.note}</span>
        )}
      </span>
      <span className="shrink-0 text-muted">›</span>
    </>
  );

  /*
   * Raden leder till skannern, inte rakt till loggningen — även när maskinen
   * redan finns. Skanningen är en kontroll att du står vid rätt maskin, och
   * fångar att man råkar logga bänkpress på ett löpband. Saknas maskinen helt
   * blir skanningen dessutom registreringen, med namnet från passet ifyllt.
   *
   * För stänger, bänkar och annat utan kod finns en väg förbi på skannersidan.
   */
  return (
    <li>
      <Link
        href={`/scan?expect=${encodeURIComponent(exercise.machine)}`}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-2"
      >
        {body}
      </Link>
      {!machineId && (
        <p className="px-4 pb-3 text-xs text-muted">
          Inte registrerad än — skanna den, eller välj “ingen QR-kod”.
        </p>
      )}
    </li>
  );
}
