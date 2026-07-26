"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Button,
  ChipGroup,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  SectionTitle,
  Spinner,
  Stepper,
  TextInput,
} from "@/components/ui";
import { addSet, deleteSet, ensureActiveSession } from "@/lib/db";
import { formatClock, formatDuration, formatNumber } from "@/lib/format";
import { lastSetFor, setWeight } from "@/lib/stats";
import { useData, useTicker } from "@/lib/useData";
import type { Machine, Metric, SetEntry } from "@/lib/types";

export default function MachinePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MachineLogger />
    </Suspense>
  );
}

function MachineLogger() {
  const params = useSearchParams();
  const machineId = params.get("id") ?? "";
  const { data, loading, error, reload } = useData();
  /*
   * Tidsstämpeln för det set vars vila man tryckt bort. Sparas som stämpel och
   * inte som en boolean, så att timern kommer tillbaka av sig själv vid nästa
   * set — man vill dölja *den här* vilan, inte stänga av funktionen.
   */
  const [dismissedRest, setDismissedRest] = useState<number | null>(null);

  const machine = data.machines.find((m) => m.id === machineId);
  const gym = data.gyms.find((g) => g.id === machine?.gymId);
  const previous = useMemo(
    () => (machine ? lastSetFor(data.sets, machine.id) : undefined),
    [data.sets, machine],
  );

  /** Hur många set det blev totalt förra gången — "10 reps × 3 set". */
  const previousSetCount = useMemo(
    () =>
      previous
        ? data.sets.filter(
            (s) =>
              s.machineId === previous.machineId &&
              s.sessionId === previous.sessionId,
          ).length
        : 0,
    [data.sets, previous],
  );

  /** Set på den här maskinen i det pågående passet. */
  const todaySets = useMemo(() => {
    if (!machine || !data.activeSession) return [];
    return data.sets
      .filter(
        (s) =>
          s.machineId === machine.id && s.sessionId === data.activeSession!.id,
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data.sets, data.activeSession, machine]);

  const lastSetAt = todaySets[todaySets.length - 1]?.timestamp;

  if (loading || error) return <Spinner error={error} />;

  if (!machine) {
    return (
      <div>
        <PageHeader title="Maskinen hittades inte" />
        <EmptyState
          title="Borttagen eller okänd"
          body="Maskinen finns inte längre i din logg. Skanna QR-koden igen så kan du registrera den på nytt."
          action={<LinkButton href="/scan" variant="primary">Skanna maskin</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={machine.name}
        subtitle={`${gym?.name ?? "Okänt gym"} · ${machine.muscleGroup}`}
        action={
          <Link
            href={`/machine/edit?id=${machine.id}`}
            aria-label="Redigera maskin"
            className="tap flex w-10 items-center justify-center rounded-xl text-muted active:bg-surface-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </Link>
        }
      />

      <PreviousCard previous={previous} setCount={previousSetCount} />
      {data.profile.restTimer !== false && (
        <RestTimer
          lastAt={
            lastSetAt && lastSetAt !== dismissedRest ? lastSetAt : undefined
          }
          onDismiss={() => setDismissedRest(lastSetAt ?? null)}
        />
      )}

      <SetForm
        machine={machine}
        previous={previous}
        nextSetNumber={todaySets.length + 1}
        onSaved={reload}
      />

      {todaySets.length > 0 && (
        <>
          <SectionTitle>Dagens set</SectionTitle>
          <ul className="card divide-y divide-line">
            {todaySets.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold tabular-nums">
                  {s.setNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">
                    {describeSetShort(s)}
                  </span>
                  <span className="text-xs text-muted">
                    {formatClock(s.timestamp)}
                    {s.restSec && s.restSec < 900
                      ? ` · vila ${formatDuration(s.restSec)}`
                      : ""}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Ta bort set ${s.setNumber}`}
                  onClick={async () => {
                    await deleteSet(s.id);
                    await reload();
                  }}
                  className="tap w-9 shrink-0 rounded-lg text-muted active:bg-surface-2"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- delkomponenter */

function PreviousCard({
  previous,
  setCount,
}: {
  previous?: SetEntry;
  setCount: number;
}) {
  if (!previous) {
    return (
      <p className="card px-4 py-3 text-sm text-muted">
        Första gången på den här maskinen. Nästa gång visas dina senaste vikter här.
      </p>
    );
  }
  return (
    <div className="card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">
        Senaste
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums leading-tight">
        {describeSetShort(previous)}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {new Date(previous.timestamp).toLocaleDateString("sv-SE", {
          day: "numeric",
          month: "short",
        })}{" "}
        · {setCount} set
      </p>
    </div>
  );
}

/**
 * Prickar för genomförda set mot målet.
 *
 * Ska gå att uppfatta med en blick mitt i ett pass, utan att läsa siffror —
 * därav prickar i stället för bara text.
 */
function SetProgress({ done, target }: { done: number; target: number }) {
  const complete = done >= target;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1.5">
        {Array.from({ length: Math.max(target, done) }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < done
                ? "bg-brand"
                : "border border-line bg-surface-2"
            }`}
          />
        ))}
      </div>
      {complete && (
        <span className="text-sm font-semibold text-brand">
          {done > target ? `${done} set — över målet` : "Klart"}
        </span>
      )}
    </div>
  );
}

/**
 * Räknar upp sedan senaste setet, så man vet när det är dags igen.
 *
 * Går att stänga med ett tryck. Är man klar med övningen och på väg till nästa
 * maskin fyller den ingen funktion, och tidigare fanns inget sätt att bli av
 * med den annat än att spara ännu ett set.
 */
function RestTimer({
  lastAt,
  onDismiss,
}: {
  lastAt?: number;
  onDismiss: () => void;
}) {
  useTicker(Boolean(lastAt));
  if (!lastAt) return null;
  const seconds = (Date.now() - lastAt) / 1000;
  if (seconds > 900) return null; // Efter 15 min är det ingen vila längre.
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <p className="text-sm text-muted">
        Vila:{" "}
        <span className="font-bold tabular-nums text-white">
          {formatDuration(seconds)}
        </span>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dölj vilotimern"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted active:bg-surface-2"
      >
        ✕
      </button>
    </div>
  );
}

function SetForm({
  machine,
  previous,
  nextSetNumber,
  onSaved,
}: {
  machine: Machine;
  previous?: SetEntry;
  nextSetNumber: number;
  onSaved: () => Promise<void>;
}) {
  const has = (m: Metric) => machine.metrics.includes(m);

  const [weight, setWeightValue] = useState(0);
  const [extra, setExtra] = useState(0);
  const [reps, setReps] = useState(10);
  const [time, setTime] = useState("");
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [incline, setIncline] = useState(0);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Förifyll med senaste passets värden — oftast kör man samma vikt igen.
  useEffect(() => {
    if (!previous) return;
    setWeightValue(previous.weight ?? 0);
    setExtra(previous.extraWeight ?? 0);
    setReps(previous.reps ?? 10);
    setSpeed(previous.speed ?? 0);
    setDistance(previous.distanceKm ?? 0);
    setIncline(previous.incline ?? 0);
    setTime(previous.durationSec ? formatDuration(previous.durationSec) : "");
  }, [previous]);

  const plateOptions = [0, ...machine.plateOptions];
  const total = weight + extra;

  async function save() {
    setSaving(true);
    const session = await ensureActiveSession(machine.gymId);
    await addSet({
      sessionId: session.id,
      machineId: machine.id,
      weight: has("weight") ? weight : undefined,
      extraWeight: has("extraPlate") && extra > 0 ? extra : undefined,
      reps: has("reps") ? reps : undefined,
      durationSec: has("time") ? parseMmSs(time) : undefined,
      speed: has("speed") && speed > 0 ? speed : undefined,
      distanceKm: has("distance") && distance > 0 ? distance : undefined,
      incline: has("incline") && incline > 0 ? incline : undefined,
    });
    navigator.vibrate?.(30);
    await onSaved();
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  }

  return (
    <section className="mt-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">
          Set {nextSetNumber}
          {machine.targetSets && (
            <span className="font-medium text-muted"> av {machine.targetSets}</span>
          )}
        </h2>
        {has("weight") && total > 0 && (
          <p className="text-sm text-muted">
            Totalt{" "}
            <span className="font-bold tabular-nums text-brand">
              {formatNumber(total)} kg
            </span>
          </p>
        )}
      </div>

      {machine.targetSets && (
        <SetProgress done={nextSetNumber - 1} target={machine.targetSets} />
      )}

      {has("weight") && (
        <Field label="Vikt">
          <Stepper
            value={weight}
            onChange={setWeightValue}
            step={machine.weightStep}
            decimals
            suffix="kg"
          />
        </Field>
      )}

      {has("extraPlate") && machine.plateOptions.length > 0 && (
        <Field label="Extra vikt">
          <ChipGroup
            options={plateOptions}
            value={extra}
            onChange={setExtra}
            render={(p) => (p === 0 ? "Ingen" : `+${String(p).replace(".", ",")} kg`)}
          />
        </Field>
      )}

      {has("reps") && (
        <Field label="Repetitioner">
          <Stepper value={reps} onChange={setReps} step={1} min={1} max={200} />
        </Field>
      )}

      {has("time") && (
        <Field label="Tid" hint="Format mm:ss, till exempel 3:50">
          <TextInput
            value={time}
            onChange={(e) => setTime(e.target.value)}
            inputMode="numeric"
            placeholder="3:50"
          />
        </Field>
      )}

      {has("speed") && (
        <Field label="Hastighet">
          <Stepper value={speed} onChange={setSpeed} step={0.5} decimals suffix="km/h" />
        </Field>
      )}

      {has("distance") && (
        <Field label="Distans">
          <Stepper value={distance} onChange={setDistance} step={0.1} decimals suffix="km" />
        </Field>
      )}

      {has("incline") && (
        <Field label="Lutning">
          <Stepper value={incline} onChange={setIncline} step={0.5} decimals suffix="%" />
        </Field>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Sparar…" : justSaved ? "Sparat ✓" : "Spara set"}
      </Button>
    </section>
  );
}

/* ---------------------------------------------------------------- hjälpare */

/** "3:50" -> 230 sekunder. Rena siffror tolkas som sekunder. */
function parseMmSs(value: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const parts = text.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function describeSetShort(s: SetEntry): string {
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
  return parts.join(" · ") || "—";
}
