"use client";

import { useMemo, useState } from "react";
import { sessionsWithSets } from "@/lib/stats";
import type { Session, SetEntry } from "@/lib/types";

const WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Månadsöversikt där dagar man tränat är ifyllda.
 *
 * Siffror som "0,47 pass per vecka" säger ingenting om man faktiskt håller
 * igång. Ett rutnät gör luckorna synliga direkt — man ser att det gick tio
 * dagar mellan passen utan att räkna.
 */
export function TrainingCalendar({
  sessions,
  sets,
}: {
  sessions: Session[];
  sets: SetEntry[];
}) {
  // 0 = den här månaden, -1 = förra, och så vidare.
  const [offset, setOffset] = useState(0);

  const trained = useMemo(() => {
    const days = new Set<number>();
    for (const s of sessionsWithSets(sessions, sets)) {
      days.add(startOfDay(s.startedAt));
    }
    return days;
  }, [sessions, sets]);

  const { cells, label, count, isCurrentMonth } = useMemo(() => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = month.getFullYear();
    const m = month.getMonth();

    const daysInMonth = new Date(year, m + 1, 0).getDate();
    // getDay() ger söndag = 0. Veckan börjar på måndag i Sverige.
    const firstWeekday = (new Date(year, m, 1).getDay() + 6) % 7;

    const list: ({ day: number; ts: number } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ day: d, ts: new Date(year, m, d).getTime() });
    }

    const name = month.toLocaleDateString("sv-SE", {
      month: "long",
      year: "numeric",
    });

    return {
      cells: list,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      count: list.filter((c) => c && trained.has(c.ts)).length,
      isCurrentMonth: offset === 0,
    };
  }, [offset, trained]);

  const today = startOfDay(Date.now());

  return (
    <div className="card px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Föregående månad"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted active:bg-surface-2"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs text-muted">
            {count} {count === 1 ? "pass" : "pass"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={isCurrentMonth}
          aria-label="Nästa månad"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted active:bg-surface-2 disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[10px] font-semibold text-muted"
          >
            {d}
          </div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <div key={`tom-${i}`} />;
          const done = trained.has(cell.ts);
          const isToday = cell.ts === today;
          const future = cell.ts > today;
          return (
            <div
              key={cell.ts}
              className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold ${
                done
                  ? "bg-brand text-ink"
                  : future
                    ? "text-muted/30"
                    : "bg-surface-2 text-muted"
              } ${isToday && !done ? "ring-1 ring-brand" : ""}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
