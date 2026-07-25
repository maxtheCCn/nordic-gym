"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  LinkButton,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  TextInput,
} from "@/components/ui";
import { clearAll, exportBackup, importBackup, saveProfile } from "@/lib/db";
import { useData } from "@/lib/useData";
import { GOALS, type Goal } from "@/lib/types";

export default function SettingsPage() {
  const { data, loading, reload } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (loading || hydrated) return;
    setName(data.profile.name ?? "");
    setAge(data.profile.age ? String(data.profile.age) : "");
    setBodyWeight(data.profile.bodyWeight ? String(data.profile.bodyWeight) : "");
    setHydrated(true);
  }, [loading, data.profile, hydrated]);

  async function persist(patch: Parameters<typeof saveProfile>[0]) {
    await saveProfile(patch);
    await reload();
  }

  async function handleExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nw-logg-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Säkerhetskopian är sparad.");
  }

  async function handleImport(file: File) {
    try {
      const backup = JSON.parse(await file.text());
      await importBackup(backup);
      await reload();
      setStatus("Data importerad.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Kunde inte läsa filen.");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="pb-6">
      <PageHeader title="Inställningar" back={false} />

      {/* ------------------------------------------------------------ profil */}
      <SectionTitle>Om dig</SectionTitle>
      <div className="space-y-3">
        <Field label="Namn">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => persist({ name: name.trim() || undefined })}
            placeholder="Valfritt"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ålder">
            <TextInput
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onBlur={() => persist({ age: Number(age) || undefined })}
            />
          </Field>
          <Field label="Kroppsvikt">
            <TextInput
              type="number"
              inputMode="decimal"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              onBlur={() =>
                persist({ bodyWeight: Number(bodyWeight) || undefined })
              }
            />
          </Field>
        </div>
        <Field label="Mål">
          <Select
            value={data.profile.goal ?? ""}
            onChange={(e) => persist({ goal: e.target.value as Goal })}
          >
            <option value="" disabled>
              Välj mål
            </option>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        {data.gyms.length > 0 && (
          <Field
            label="Hemmagym"
            hint="Väljs automatiskt när ett nytt pass startas."
          >
            <Select
              value={data.profile.homeGymId ?? ""}
              onChange={(e) => persist({ homeGymId: e.target.value })}
            >
              <option value="" disabled>
                Välj gym
              </option>
              {data.gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {/* ---------------------------------------------------------- maskiner */}
      <SectionTitle>Maskiner ({data.machines.length})</SectionTitle>
      {data.machines.length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Inga maskiner sparade. Gör din Nordic Wellness-runda och skanna
          QR-koderna på maskinerna du använder.
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {data.machines.map((m) => (
            <li key={m.id}>
              <Link
                href={`/machine/edit?id=${m.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold leading-tight">
                    {m.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {m.muscleGroup} ·{" "}
                    {data.gyms.find((g) => g.id === m.gymId)?.name ?? "Okänt gym"}
                  </span>
                </span>
                <span className="shrink-0 text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <LinkButton href="/scan" variant="primary" className="flex-1">
          Skanna ny maskin
        </LinkButton>
        <LinkButton href="/machine/new" className="flex-1">
          Lägg till manuellt
        </LinkButton>
      </div>

      {/* ---------------------------------------------------------- rapport */}
      <SectionTitle>AI-analys</SectionTitle>
      <LinkButton href="/report" variant="primary" className="w-full">
        Skapa träningsrapport
      </LinkButton>
      <p className="mt-2 text-xs text-muted">
        Appen analyserar ingenting själv. Den bygger en textrapport som du
        kopierar in i den AI du vill använda.
      </p>

      {/* ------------------------------------------------------------- data */}
      <SectionTitle>Din data</SectionTitle>
      <p className="mb-2 text-xs text-muted">
        Allt sparas bara i den här webbläsaren — inget konto, ingen server.
        Exportera regelbundet om du byter telefon eller rensar webbläsardata.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={handleExport}>
          Exportera
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
        >
          Importera
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = "";
        }}
      />

      {status && (
        <p className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-muted">
          {status}
        </p>
      )}

      <div className="mt-4">
        {confirmClear ? (
          <div className="card p-4">
            <p className="text-sm text-muted">
              All träningsdata raderas permanent: {data.sessions.length} pass,{" "}
              {data.sets.length} set och {data.machines.length} maskiner.
              Exportera först om du vill kunna återställa.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await clearAll();
                  await reload();
                  setConfirmClear(false);
                  setStatus("All data är raderad.");
                }}
              >
                Ja, radera allt
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmClear(false)}
              >
                Avbryt
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setConfirmClear(true)}
          >
            Radera all data
          </Button>
        )}
      </div>
    </div>
  );
}
