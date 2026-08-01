"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  TextInput,
} from "@/components/ui";
import { addSupplement, deleteSupplement, listSupplements } from "@/lib/db";
import { formatClock, formatNumber, relativeDay } from "@/lib/format";
import {
  COMMON_SUPPLEMENTS,
  SUPPLEMENT_UNITS,
  type SupplementEntry,
} from "@/lib/types";

const DAY = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Loggbok för tillskott.
 *
 * Följer med i träningsrapporten, så att den som analyserar träningen ser
 * helheten — kreatin och proteinintag påverkar både resultat och hur mycket
 * volym man tål.
 */
export default function SupplementsPage() {
  const [entries, setEntries] = useState<SupplementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("g");

  const refresh = useCallback(async () => {
    setEntries(await listSupplements());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = startOfDay(Date.now());
  const todays = useMemo(
    () => entries.filter((e) => startOfDay(e.timestamp) === today),
    [entries, today],
  );

  /**
   * Snabbknappar byggda på vad du faktiskt brukar ta, med vanliga förslag som
   * utfyllnad tills det finns egen historik.
   */
  const quick = useMemo(() => {
    const seen = new Map<string, { name: string; amount?: number; unit?: string }>();
    for (const e of entries) {
      const key = e.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: e.name, amount: e.amount, unit: e.unit });
    }
    for (const c of COMMON_SUPPLEMENTS) {
      if (seen.size >= 6) break;
      if (!seen.has(c.name.toLowerCase())) seen.set(c.name.toLowerCase(), c);
    }
    return [...seen.values()].slice(0, 6);
  }, [entries]);

  /** De sju senaste dagarna, för att se om det blir av regelbundet. */
  const week = useMemo(() => {
    const days: { day: number; items: SupplementEntry[] }[] = [];
    for (let i = 1; i <= 6; i++) {
      const day = today - i * DAY;
      const items = entries.filter((e) => startOfDay(e.timestamp) === day);
      if (items.length) days.push({ day, items });
    }
    return days;
  }, [entries, today]);

  async function log(
    entry: { name: string; amount?: number; unit?: string },
  ) {
    if (!entry.name.trim()) return;
    await addSupplement({
      name: entry.name.trim(),
      amount: entry.amount,
      unit: entry.unit,
      deletedAt: null,
    });
    await refresh();
  }

  if (loading) return <Spinner />;

  return (
    <div className="pb-6">
      <PageHeader
        title="Tillskott"
        subtitle="Följer med i träningsrapporten"
      />

      <SectionTitle>Snabbval</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => (
          <button
            key={q.name}
            type="button"
            onClick={() => log(q)}
            className="tap rounded-xl border border-line bg-surface-2 px-4 text-[15px] font-semibold active:bg-line"
          >
            {q.name}
            {q.amount ? (
              <span className="ml-1.5 text-muted">
                {formatNumber(q.amount)} {q.unit}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <SectionTitle>Idag</SectionTitle>
      {todays.length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Inget loggat idag. Tryck på ett snabbval ovan, eller lägg till nedan.
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {todays.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold leading-tight">
                  {e.name}
                </span>
                <span className="text-xs text-muted">
                  {formatClock(e.timestamp)}
                </span>
              </span>
              {e.amount ? (
                <span className="shrink-0 font-bold tabular-nums">
                  {formatNumber(e.amount)} {e.unit}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Ta bort ${e.name}`}
                onClick={async () => {
                  await deleteSupplement(e.id);
                  await refresh();
                }}
                className="tap w-9 shrink-0 rounded-lg text-muted active:bg-surface-2"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Lägg till annat</SectionTitle>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await log({
            name,
            amount: amount ? Number(amount.replace(",", ".")) : undefined,
            unit: amount ? unit : undefined,
          });
          setName("");
          setAmount("");
        }}
      >
        <Field label="Vad">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Kreatin"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mängd">
            <TextInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="5"
            />
          </Field>
          <Field label="Enhet">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {SUPPLEMENT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" className="w-full" disabled={!name.trim()}>
          Logga
        </Button>
      </form>

      {week.length > 0 && (
        <>
          <SectionTitle>Tidigare dagar</SectionTitle>
          <div className="space-y-3">
            {week.map(({ day, items }) => (
              <div key={day} className="card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  {relativeDay(day)}
                </p>
                <p className="mt-1 text-sm">
                  {items
                    .map(
                      (i) =>
                        `${i.name}${i.amount ? ` ${formatNumber(i.amount)} ${i.unit}` : ""}`,
                    )
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
