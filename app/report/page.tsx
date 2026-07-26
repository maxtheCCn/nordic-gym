"use client";

import { useMemo, useState } from "react";
import {
  Button,
  ChipGroup,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from "@/components/ui";
import { saveProfile } from "@/lib/db";
import { buildReport } from "@/lib/report";
import { useData } from "@/lib/useData";
import { GOALS, type Goal } from "@/lib/types";

const PERIODS = [30, 90, 365, 0] as const;
const PERIOD_LABELS: Record<number, string> = {
  30: "30 dagar",
  90: "3 mån",
  365: "1 år",
  0: "Allt",
};

export default function ReportPage() {
  const { data, loading, error, reload } = useData();
  const [days, setDays] = useState<number>(30);
  const [includeSessions, setIncludeSessions] = useState(true);
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    if (loading) return "";
    return buildReport(
      { machines: data.machines, sessions: data.sessions, sets: data.sets },
      data.profile,
      data.gyms,
      { days, includeSessions, extraNotes: notes },
    );
  }, [loading, data, days, includeSessions, notes]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // Clipboard-API kräver https och användargest — fall tillbaka på det
      // gamla sättet så att kopieringen fungerar även i äldre webbläsare.
      const el = document.createElement("textarea");
      el.value = report;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Min träningsrapport", text: report });
      } catch {
        /* Användaren avbröt delningen. */
      }
    } else {
      await copy();
    }
  }

  function download() {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traningsrapport-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-6">
      <PageHeader
        title="Träningsrapport"
        subtitle="Färdig text att klistra in i valfri AI för analys"
      />

      {/* Ålder och mål ingår i rapporten — fråga direkt om de saknas. */}
      {(!data.profile.age || !data.profile.goal) && (
        <div className="card mb-4 space-y-3 p-4">
          <p className="text-sm text-muted">
            Fyll i ålder och mål så blir analysen mer träffsäker.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ålder">
              {/* Sparar direkt vid inmatning i stället för vid blur — annars
                  riskerar åldern att tappas om man skriver den och trycker
                  "Kopiera rapporten" utan att lämna fältet först. */}
              <TextInput
                type="number"
                inputMode="numeric"
                value={data.profile.age ?? ""}
                onChange={async (e) => {
                  const age = Number(e.target.value);
                  await saveProfile({ age: age > 0 ? age : undefined });
                  await reload();
                }}
              />
            </Field>
            <Field label="Mål">
              <Select
                defaultValue={data.profile.goal ?? ""}
                onChange={async (e) => {
                  await saveProfile({ goal: e.target.value as Goal });
                  await reload();
                }}
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
          </div>
        </div>
      )}

      <SectionTitle>Period</SectionTitle>
      <ChipGroup
        options={[...PERIODS]}
        value={days as (typeof PERIODS)[number]}
        onChange={(v) => setDays(v)}
        render={(v) => PERIOD_LABELS[v]}
      />

      <SectionTitle>Detaljnivå</SectionTitle>
      <ChipGroup
        options={["Varje pass", "Bara sammanfattning"]}
        value={includeSessions ? "Varje pass" : "Bara sammanfattning"}
        onChange={(v) => setIncludeSessions(v === "Varje pass")}
      />

      <SectionTitle>Egna anteckningar</SectionTitle>
      <TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="T.ex. ont i axeln, tränar 3 gånger i veckan, vill bli starkare i bänkpress…"
      />

      <div className="mt-5 space-y-2">
        <Button size="lg" className="w-full" onClick={copy}>
          {copied ? "Kopierat ✓" : "Kopiera rapporten"}
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={share}>
            Dela
          </Button>
          <Button variant="secondary" className="flex-1" onClick={download}>
            Spara som fil
          </Button>
        </div>
      </div>

      <SectionTitle>Förhandsvisning</SectionTitle>
      <pre className="card max-h-96 overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-xs leading-relaxed text-muted">
        {report}
      </pre>
      <p className="mt-2 text-center text-xs text-muted">
        {report.length.toLocaleString("sv-SE")} tecken
      </p>
    </div>
  );
}
