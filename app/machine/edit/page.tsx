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
import { deleteMachine, ensureGym, saveMachine } from "@/lib/db";
import { useData } from "@/lib/useData";
import {
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

export default function EditMachinePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EditMachineForm />
    </Suspense>
  );
}

function EditMachineForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { data, loading, error } = useData();
  const machine = data.machines.find((m) => m.id === id);

  const [gymName, setGymName] = useState("");
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Bröst");
  const [type, setType] = useState<MachineType>("strength");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [plates, setPlates] = useState<number[]>([]);
  const [weightStep, setWeightStep] = useState(2.5);
  const [targetSets, setTargetSets] = useState(3);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!machine || ready) return;
    setGymName(data.gyms.find((g) => g.id === machine.gymId)?.name ?? "");
    setName(machine.name);
    setMuscleGroup(machine.muscleGroup);
    setType(machine.type);
    setMetrics(machine.metrics);
    setPlates(machine.plateOptions);
    setWeightStep(machine.weightStep);
    setTargetSets(machine.targetSets ?? 3);
    setReady(true);
  }, [machine, data.gyms, ready]);

  if (loading || error) return <Spinner error={error} />;
  if (!machine) {
    return (
      <div>
        <PageHeader title="Maskinen hittades inte" />
      </div>
    );
  }

  const setCount = data.sets.filter((s) => s.machineId === machine.id).length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!machine) return;
    const gym = await ensureGym(gymName || "Nordic Wellness");
    await saveMachine({
      ...machine,
      gymId: gym.id,
      name: name.trim(),
      muscleGroup,
      type,
      metrics,
      plateOptions: [...plates].sort((a, b) => a - b),
      weightStep,
      targetSets,
    });
    router.replace(`/machine?id=${machine.id}`);
  }

  return (
    <form onSubmit={handleSave} className="pb-6">
      <PageHeader title="Redigera maskin" subtitle={machine.name} />

      <div className="space-y-4">
        <Field label="Gym">
          <TextInput
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            list="gym-list-edit"
          />
          <datalist id="gym-list-edit">
            {data.gyms.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </Field>

        <Field label="Maskinnamn">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Maskintyp">
          <Select value={type} onChange={(e) => setType(e.target.value as MachineType)}>
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
              onClick={() =>
                setMetrics((c) =>
                  active ? c.filter((m) => m !== metric) : [...c, metric],
                )
              }
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
          <SectionTitle>Extra viktplattor</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {PLATE_PRESETS.map((plate) => {
              const active = plates.includes(plate);
              return (
                <button
                  key={plate}
                  type="button"
                  onClick={() =>
                    setPlates((c) =>
                      active ? c.filter((p) => p !== plate) : [...c, plate],
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
          <Field label="Viktsteg">
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
          hint="Visas som “Set 2 av 3” när du loggar."
        >
          <Stepper value={targetSets} onChange={setTargetSets} min={1} max={20} />
        </Field>
      </div>

      <Button type="submit" size="lg" className="mt-6 w-full">
        Spara ändringar
      </Button>

      <SectionTitle>Ta bort</SectionTitle>
      {confirmDelete ? (
        <div className="card p-4">
          <p className="text-sm text-muted">
            Maskinen och dess {setCount} loggade set tas bort permanent. Det går
            inte att ångra.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={async () => {
                await deleteMachine(machine.id);
                router.replace("/settings");
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
          Ta bort maskin
        </Button>
      )}
    </form>
  );
}
