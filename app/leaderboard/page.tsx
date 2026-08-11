"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, shrinkImage } from "@/components/Avatar";
import {
  Button,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  TextInput,
} from "@/components/ui";
import { formatNumber } from "@/lib/format";
import {
  avatarUrl,
  currentUserId,
  deleteLift,
  fetchLifts,
  LIFT_CATEGORIES,
  saveLift,
  uploadAvatar,
  type Lift,
} from "@/lib/leaderboard";
import { syncConfigured } from "@/lib/supabase";
import { useData } from "@/lib/useData";

/**
 * Topplistan.
 *
 * Lyften läggs in för hand — man väljer övning och skriver sitt max. Det som
 * står här är alltså ett påstående, inte något appen räknat fram, och därför
 * finns bocken: en administratör som sett lyftet kan märka det som styrkt.
 */
export default function LeaderboardPage() {
  const { data } = useData();
  const [lifts, setLifts] = useState<Lift[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    if (!syncConfigured) {
      setLoading(false);
      return;
    }
    try {
      const [rows, me] = await Promise.all([fetchLifts(), currentUserId()]);
      setLifts(rows);
      setUid(me);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta topplistan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Kategori → övning → lyft, tyngst först. */
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Map<string, Lift[]>>();
    for (const lift of lifts) {
      const exercises = byCategory.get(lift.category) ?? new Map();
      const list = exercises.get(lift.exercise) ?? [];
      list.push(lift);
      exercises.set(lift.exercise, list);
      byCategory.set(lift.category, exercises);
    }
    for (const exercises of byCategory.values()) {
      for (const list of exercises.values()) list.sort((a, b) => b.weight - a.weight);
    }
    return [...byCategory.entries()].sort(
      (a, b) => LIFT_CATEGORIES.indexOf(a[0] as never) - LIFT_CATEGORIES.indexOf(b[0] as never),
    );
  }, [lifts]);

  if (loading) return <Spinner />;

  if (!syncConfigured) {
    return (
      <div>
        <PageHeader title="Topplista" back={false} />
        <p className="card px-4 py-3 text-sm text-muted">
          Topplistan kräver att synken är påslagen.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <PageHeader
        title="Topplista"
        back={false}
        subtitle="Lägg in dina max och jämför med de andra"
        action={
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Lägg till lyft"
            className="tap flex w-11 items-center justify-center rounded-xl bg-brand text-2xl font-bold text-ink active:bg-brand-dim"
          >
            +
          </button>
        }
      />

      {error && (
        <p className="card mb-4 px-4 py-3 text-sm text-warn">{error}</p>
      )}

      {adding && (
        <AddLift
          defaultName={data.profile.name ?? ""}
          machines={data.machines.map((m) => m.name)}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      )}

      {grouped.length === 0 && !adding && (
        <div className="card px-4 py-6 text-center">
          <p className="font-semibold">Inga lyft än</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
            Tryck på plus uppe till höger och lägg in ditt första max.
          </p>
        </div>
      )}

      {grouped.map(([category, exercises]) => (
        <section key={category} className="mb-6">
          <SectionTitle>{category}</SectionTitle>
          <div className="space-y-3">
            {[...exercises.entries()]
              .sort((a, b) => a[0].localeCompare(b[0], "sv"))
              .map(([exercise, list]) => (
                <div key={exercise} className="card overflow-hidden">
                  <p className="border-b border-line px-4 py-2.5 text-sm font-bold">
                    {exercise}
                  </p>
                  <ul className="divide-y divide-line">
                    {list.map((lift, i) => (
                      <li
                        key={lift.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          lift.user_id === uid ? "bg-brand/5" : ""
                        }`}
                      >
                        <span className="w-5 shrink-0 text-center text-sm font-bold text-muted">
                          {i + 1}
                        </span>
                        <Avatar
                          name={lift.display_name}
                          src={avatarUrl(lift.avatar_path)}
                          size={32}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-semibold leading-tight">
                              {lift.display_name}
                            </span>
                            {lift.verified && (
                              <span
                                title="Godkänt av admin"
                                className="shrink-0 text-sm text-brand"
                              >
                                ✓
                              </span>
                            )}
                          </span>
                          {lift.reps ? (
                            <span className="text-xs text-muted">
                              {lift.reps} reps
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">
                          {formatNumber(lift.weight)} kg
                        </span>
                        {lift.user_id === uid && (
                          <button
                            type="button"
                            aria-label="Ta bort lyft"
                            onClick={async () => {
                              await deleteLift(lift.id);
                              await refresh();
                            }}
                            className="tap w-8 shrink-0 rounded-lg text-muted active:bg-surface-2"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}

      <p className="mt-2 text-xs text-muted">
        Bocken betyder att en administratör godkänt lyftet. Utan bock är det ett
        påstående som ingen kontrollerat.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- lägg till */

function AddLift({
  defaultName,
  machines,
  onClose,
  onSaved,
}: {
  defaultName: string;
  machines: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(defaultName);
  const [category, setCategory] = useState<string>(LIFT_CATEGORIES[0]);
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto(file: File) {
    setBusy(true);
    setError(null);
    try {
      // Krymps i telefonen först — en kamerabild är flera megabyte och visas
      // som en cirkel på 32 pixlar.
      const path = await uploadAvatar(await shrinkImage(file));
      setAvatarPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda upp bilden.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const kg = Number(weight.replace(",", "."));
    if (!displayName.trim() || !exercise.trim() || !Number.isFinite(kg) || kg <= 0) {
      setError("Fyll i namn, övning och en vikt.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveLift({
        displayName: displayName.trim(),
        avatarPath,
        category,
        exercise: exercise.trim(),
        weight: kg,
        reps: reps ? Number(reps) : null,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara lyftet.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 space-y-3 p-4">
      <p className="font-bold">Lägg till lyft</p>

      <div className="flex items-center gap-3">
        <Avatar name={displayName || "?"} src={avatarUrl(avatarPath)} size={48} />
        <div className="flex-1">
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => photoRef.current?.click()}
          >
            {avatarPath ? "Byt profilbild" : "Lägg till profilbild"}
          </Button>
          <p className="mt-1 text-xs text-muted">
            Utan bild visas din initial.
          </p>
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickPhoto(f);
            e.target.value = "";
          }}
        />
      </div>

      <Field label="Visningsnamn">
        <TextInput
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Max"
        />
      </Field>

      <Field label="Kategori">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {LIFT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Övning" hint="Skriv fritt, eller välj bland dina maskiner.">
        <TextInput
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          list="ovningar"
          placeholder="Ben press"
        />
        <datalist id="ovningar">
          {machines.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Vikt (kg)">
          <TextInput
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            placeholder="123"
          />
        </Field>
        <Field label="Reps" hint="Valfritt.">
          <TextInput
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            inputMode="numeric"
            placeholder="1"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-warn">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Sparar…" : "Spara"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
