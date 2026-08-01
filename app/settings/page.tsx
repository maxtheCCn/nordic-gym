"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  ChipGroup,
  Field,
  LinkButton,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from "@/components/ui";
import { SyncPanel } from "@/components/SyncPanel";
import { buildLabel, reloadFresh } from "@/components/UpdateBanner";
import { enterDemo, exitDemo, isDemo, resetDemoData } from "@/lib/demo";
import { clearAll, exportBackup, importBackup, saveProfile } from "@/lib/db";
import { useData } from "@/lib/useData";
import { GOALS, type Goal } from "@/lib/types";

export default function SettingsPage() {
  const { data, loading, error, reload } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Läses efter montering — localStorage finns inte när sidan byggs statiskt.
  const [demoOn, setDemoOn] = useState(false);
  useEffect(() => setDemoOn(isDemo()), []);

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

  /**
   * Kopierar hela loggen som text.
   *
   * Filhantering på iPhone är en omväg: nedladdningen hamnar någonstans i
   * Filer och ska sedan hittas igen, ofta ett år senare och under stress. Som
   * text kan den klistras in i Anteckningar, ett mejl till sig själv eller vad
   * som helst som användaren faktiskt hittar tillbaka till.
   */
  async function copyAsText() {
    const backup = await exportBackup();
    const text = JSON.stringify(backup);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setStatus(
      `Hela loggen är kopierad (${Math.round(text.length / 1024)} kB). ` +
        "Klistra in den i Anteckningar så har du den kvar även om appen nollställs.",
    );
  }

  /** Återställer från inklistrad text i stället för en fil. */
  async function restoreFromText() {
    setStatus(null);
    try {
      await importBackup(JSON.parse(paste));
      await reload();
      setPaste("");
      setShowPaste(false);
      setStatus("Data återställd.");
    } catch (e) {
      setStatus(
        e instanceof SyntaxError
          ? "Texten kunde inte läsas. Kontrollera att du fick med allt, från { till }."
          : e instanceof Error
            ? e.message
            : "Kunde inte läsa texten.",
      );
    }
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

  if (loading || error) return <Spinner error={error} />;

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

      <SectionTitle>Appen</SectionTitle>
      <div className="card space-y-3 p-4">
        <p className="text-sm text-muted">
          Version <span className="font-semibold text-white">{buildLabel()}</span>
        </p>
        <p className="text-xs text-muted">
          På hemskärmen finns ingen uppdateringsknapp. Appen säger till när en
          ny version finns, men du kan hämta den härifrån när du vill.
        </p>
        <Button variant="secondary" className="w-full" onClick={reloadFresh}>
          Hämta senaste versionen
        </Button>
      </div>

      <SectionTitle>Demoläge</SectionTitle>
      {demoOn ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-muted">
            Du är i demoläget. Allt du gör här sparas i en separat databas och
            rör aldrig din riktiga träningslogg.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={exitDemo}>
              Avsluta demo
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await resetDemoData();
                window.location.reload();
              }}
            >
              Nollställ
            </Button>
          </div>
        </div>
      ) : (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-muted">
            Prova appen fritt med påhittad träningsdata — skanna, logga, radera,
            titta på statistik. Din riktiga logg påverkas inte alls.
          </p>
          <Button className="w-full" onClick={enterDemo}>
            Starta demo
          </Button>
        </div>
      )}

      <SectionTitle>Under passet</SectionTitle>
      <div className="card p-4">
        <Field
          label="Vilotimer"
          hint="Räknar upp tiden sedan ditt senaste set. Går alltid att trycka bort för stunden med ✕."
        >
          <ChipGroup
            options={["På", "Av"]}
            value={data.profile.restTimer === false ? "Av" : "På"}
            onChange={(v) => persist({ restTimer: v === "På" })}
          />
        </Field>
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

      <SyncPanel onSynced={reload} />

      <SectionTitle>Rekommenderade pass</SectionTitle>
      <LinkButton href="/plan" variant="primary" className="w-full">
        Visa rekommenderat pass
      </LinkButton>
      <p className="mt-2 text-xs text-muted">
        Skicka din träningsrapport och klistra in passet du får tillbaka. Då kan
        du följa det övning för övning, med målvikter.
      </p>

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
      <p className="mb-3 text-xs text-muted">
        Allt sparas bara i den här webbläsaren — inget konto, ingen server. Tar
        du bort appen från hemskärmen försvinner loggen med den, så ta en kopia
        då och då.
      </p>

      {/*
        Textvägen ligger först: den fungerar när filvägen inte gör det. På
        iPhone hamnar en nedladdning någonstans i Filer och ska sedan hittas
        igen — som text kan den klistras in i Anteckningar, där den är lätt att
        återfinna.
      */}
      <Button variant="primary" className="w-full" onClick={copyAsText}>
        Kopiera hela loggen som text
      </Button>
      <p className="mt-2 text-xs text-muted">
        Klistra in den i Anteckningar. Behöver du den tillbaka kopierar du
        texten därifrån och klistrar in den nedan.
      </p>

      <div className="mt-3">
        {showPaste ? (
          <div className="space-y-2">
            <TextArea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Klistra in din sparade text här"
              className="min-h-32 font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={restoreFromText}
                disabled={!paste.trim()}
              >
                Återställ
              </Button>
              <Button variant="secondary" onClick={() => setShowPaste(false)}>
                Avbryt
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowPaste(true)}
          >
            Återställ från text
          </Button>
        )}
      </div>

      <p className="mb-2 mt-5 text-xs text-muted">Eller via fil:</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={handleExport}>
          Exportera fil
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
        >
          Importera fil
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
