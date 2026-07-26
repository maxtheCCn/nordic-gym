"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Button,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  Stepper,
  TextInput,
} from "@/components/ui";
import { ensureGym, normalizeQr, saveMachine, saveProfile } from "@/lib/db";
import { useData } from "@/lib/useData";
import {
  DEFAULT_METRICS,
  MACHINE_TYPE_LABELS,
  MUSCLE_GROUPS,
  type MachineType,
  type Metric,
  type MuscleGroup,
} from "@/lib/types";

const METRIC_LABELS: Record<Metric, string> = {
  weight: "Vikt",
  extraPlate: "Extra viktplatta",
  reps: "Repetitioner",
  time: "Tid",
  speed: "Hastighet",
  distance: "Distans",
  incline: "Lutning",
};

const PLATE_PRESETS = [1.25, 2.5, 3.75, 5, 10];

export default function NewMachinePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewMachineForm />
    </Suspense>
  );
}

function NewMachineForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qrRaw = params.get("qr") ?? "";
  const { data, loading, error: dataError } = useData();

  const [gymName, setGymName] = useState("");
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Bröst");
  const [type, setType] = useState<MachineType>("strength");
  const [metrics, setMetrics] = useState<Metric[]>(DEFAULT_METRICS.strength);
  const [plates, setPlates] = useState<number[]>([2.5, 3.75, 5]);
  const [weightStep, setWeightStep] = useState(2.5);
  const [targetSets, setTargetSets] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Förifyll gymmet: hemmagymmet först, annars det enda som finns.
  useEffect(() => {
    if (loading || gymName) return;
    const home = data.gyms.find((g) => g.id === data.profile.homeGymId);
    if (home) setGymName(home.name);
    else if (data.gyms.length === 1) setGymName(data.gyms[0].name);
    else setGymName("Nordic Wellness ");
  }, [loading, data, gymName]);

  function changeType(next: MachineType) {
    setType(next);
    setMetrics(DEFAULT_METRICS[next]);
    if (next === "cardio") setMuscleGroup("Kondition");
  }

  function toggleMetric(metric: Metric) {
    setMetrics((current) =>
      current.includes(metric)
        ? current.filter((m) => m !== metric)
        : [...current, metric],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !gymName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const gym = await ensureGym(gymName);
      const machine = await saveMachine({
        qrKey: normalizeQr(qrRaw) || normalizeQr(`manuell:${name}-${Date.now()}`),
        qrRaw,
        gymId: gym.id,
        name: name.trim(),
        muscleGroup,
        type,
        metrics,
        plateOptions: [...plates].sort((a, b) => a - b),
        weightStep,
        targetSets,
      });
      // Första gymmet blir automatiskt hemmagym.
      if (!data.profile.homeGymId) await saveProfile({ homeGymId: gym.id });
      router.replace(`/machine?id=${machine.id}`);
    } catch (e) {
      setSaving(false);
      setError(
        e instanceof Error && e.name === "ConstraintError"
          ? "Den här QR-koden är redan kopplad till en annan maskin."
          : "Kunde inte spara maskinen. Försök igen.",
      );
    }
  }

  if (loading || dataError) return <Spinner error={dataError} />;

  return (
    <form onSubmit={handleSave} className="pb-6">
      <PageHeader
        title="Ny maskin"
        subtitle={
          qrRaw
            ? "Koden är okänd — fyll i maskinen en gång så känns den igen sedan"
            : "Lägg till en maskin utan QR-kod"
        }
      />

      <div className="space-y-4">
        <Field label="Gym">
          <TextInput
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="Nordic Wellness Östermalm"
            list="gym-list"
            required
          />
          <datalist id="gym-list">
            {data.gyms.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </Field>

        <Field label="Maskinnamn">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Triceps Extension"
            autoFocus
            required
          />
        </Field>

        <Field label="Maskintyp">
          <Select
            value={type}
            onChange={(e) => changeType(e.target.value as MachineType)}
          >
            {Object.entries(MACHINE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Muskelgrupp">
          <Select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
          >
            {MUSCLE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SectionTitle>Vad ska loggas?</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(METRIC_LABELS) as Metric[]).map((metric) => {
          const active = metrics.includes(metric);
          return (
            <button
              key={metric}
              type="button"
              onClick={() => toggleMetric(metric)}
              className={`tap rounded-xl border px-4 text-[15px] font-semibold ${
                active
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-line bg-surface-2 text-white"
              }`}
            >
              {METRIC_LABELS[metric]}
            </button>
          );
        })}
      </div>

      {metrics.includes("extraPlate") && (
        <>
          <SectionTitle>Extra viktplattor på maskinen</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {PLATE_PRESETS.map((plate) => {
              const active = plates.includes(plate);
              return (
                <button
                  key={plate}
                  type="button"
                  onClick={() =>
                    setPlates((current) =>
                      active
                        ? current.filter((p) => p !== plate)
                        : [...current, plate],
                    )
                  }
                  className={`tap rounded-xl border px-4 text-[15px] font-semibold tabular-nums ${
                    active
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-line bg-surface-2 text-white"
                  }`}
                >
                  +{String(plate).replace(".", ",")} kg
                </button>
              );
            })}
          </div>
        </>
      )}

      {metrics.includes("weight") && (
        <div className="mt-5">
          <Field
            label="Viktsteg"
            hint="Hur mycket vikten ändras per hål i stacken. Styr +/- knapparna."
          >
            <Select
              value={weightStep}
              onChange={(e) => setWeightStep(Number(e.target.value))}
            >
              {[1, 1.25, 2.5, 5].map((step) => (
                <option key={step} value={step}>
                  {String(step).replace(".", ",")} kg
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div className="mt-5">
        <Field
          label="Antal set du brukar köra"
          hint="Visas som “Set 2 av 3” när du loggar. Går att ändra när som helst."
        >
          <Stepper value={targetSets} onChange={setTargetSets} min={1} max={20} />
        </Field>
      </div>

      {qrRaw && (
        <p className="mt-5 break-all rounded-xl border border-line bg-surface px-3.5 py-3 text-xs text-muted">
          <span className="font-semibold text-white">QR-kod:</span> {qrRaw}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={saving || !name.trim() || !gymName.trim()}
      >
        {saving ? "Sparar…" : "Spara maskin"}
      </Button>
    </form>
  );
}
