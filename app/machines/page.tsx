"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EmptyState,
  LinkButton,
  PageHeader,
  Spinner,
  TextInput,
} from "@/components/ui";
import { formatNumber, relativeDay } from "@/lib/format";
import { lastSetFor, setWeight } from "@/lib/stats";
import { useData } from "@/lib/useData";
import type { Machine } from "@/lib/types";

/**
 * Alla maskiner, att välja bland när man inte skannar.
 *
 * Behövs för maskiner utan QR-kod — löpband, bänkar, fria vikter — men också
 * när koden sitter otillgängligt eller är repig. Utan den här sidan går en
 * manuellt tillagd maskin inte att hitta tillbaka till: startsidan visar bara
 * det man nyligen använt.
 */
export default function MachinesPage() {
  const { data, loading, error } = useData();
  const [query, setQuery] = useState("");

  const lastUsed = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of data.sets) {
      const prev = map.get(s.machineId) ?? 0;
      if (s.timestamp > prev) map.set(s.machineId, s.timestamp);
    }
    return map;
  }, [data.sets]);

  /** Muskelgrupp först, senast använda överst inom gruppen. */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = data.machines.filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.muscleGroup.toLowerCase().includes(q),
    );

    const byGroup = new Map<string, Machine[]>();
    for (const m of matching) {
      const list = byGroup.get(m.muscleGroup) ?? [];
      list.push(m);
      byGroup.set(m.muscleGroup, list);
    }
    for (const list of byGroup.values()) {
      list.sort(
        (a, b) =>
          (lastUsed.get(b.id) ?? 0) - (lastUsed.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name, "sv"),
      );
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0], "sv"));
  }, [data.machines, query, lastUsed]);

  if (loading || error) return <Spinner error={error} />;

  return (
    <div className="pb-4">
      <PageHeader
        title="Välj maskin"
        subtitle={
          data.machines.length
            ? `${data.machines.length} sparade`
            : "Inga maskiner sparade än"
        }
      />

      {data.machines.length === 0 ? (
        <EmptyState
          title="Inga maskiner än"
          body="Skanna QR-koden på maskinerna som har en. Löpband, bänkar och fria vikter lägger du till för hand."
          action={
            <LinkButton href="/machine/new" variant="primary">
              Lägg till maskin
            </LinkButton>
          }
        />
      ) : (
        <>
          {data.machines.length > 6 && (
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök maskin eller muskelgrupp"
              autoComplete="off"
              className="mb-4"
            />
          )}

          {groups.length === 0 && (
            <p className="card px-4 py-3 text-sm text-muted">
              Ingen maskin matchar ”{query}”.
            </p>
          )}

          {groups.map(([group, machines]) => (
            <section key={group} className="mb-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                {group}
              </h2>
              <ul className="card divide-y divide-line">
                {machines.map((machine) => {
                  const last = lastSetFor(data.sets, machine.id);
                  const used = lastUsed.get(machine.id);
                  return (
                    <li key={machine.id} className="flex items-stretch">
                      {/* Namnet leder till loggning — det är det man vill nio
                          gånger av tio. Redigering ligger bakom pennan. */}
                      <Link
                        href={`/machine?id=${machine.id}`}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 active:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold leading-tight">
                            {machine.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted">
                            {used ? relativeDay(used) : "Aldrig loggad"}
                          </span>
                        </span>
                        {last && setWeight(last) > 0 && (
                          <span className="shrink-0 text-sm font-bold tabular-nums text-muted">
                            {formatNumber(setWeight(last))} kg
                          </span>
                        )}
                      </Link>
                      <Link
                        href={`/machine/edit?id=${machine.id}`}
                        aria-label={`Redigera ${machine.name}`}
                        className="flex w-11 shrink-0 items-center justify-center text-muted active:bg-surface-2"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <LinkButton href="/machine/new" variant="secondary" className="w-full">
            Lägg till maskin utan QR-kod
          </LinkButton>
        </>
      )}
    </div>
  );
}
