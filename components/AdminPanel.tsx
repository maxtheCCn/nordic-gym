"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLifts,
  isAdmin,
  renameLifter,
  setVerified,
  type Lift,
} from "@/lib/leaderboard";
import { syncConfigured } from "@/lib/supabase";
import { formatNumber } from "@/lib/format";
import { Button, SectionTitle, TextInput } from "./ui";

const PASSWORD = "hmse";

/**
 * Administratörsvy för topplistan.
 *
 * Lösenordet här låser bara upp knapparna. Det ligger i appens JavaScript och
 * går att hitta för den som letar — därför är det inte det som skyddar något.
 * Skyddet sitter i databasen: bara konton som står i admins-tabellen får sätta
 * en bock, och en utlösare nollställer värdet för alla andra. Hittar någon
 * lösenordet ser hen knapparna, men servern avvisar ändringen.
 */
export function AdminPanel() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [lifts, setLifts] = useState<Lift[]>([]);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [rows, isAdm] = await Promise.all([fetchLifts(), isAdmin()]);
      setLifts(rows);
      setAdmin(isAdm);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta topplistan.");
    }
  }, []);

  useEffect(() => {
    if (unlocked) void refresh();
  }, [unlocked, refresh]);

  if (!syncConfigured) return null;

  if (!unlocked) {
    return (
      <>
        <SectionTitle>Admin</SectionTitle>
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password === PASSWORD) {
              setUnlocked(true);
              setPassword("");
              setError(null);
            } else {
              setError("Fel lösenord.");
            }
          }}
        >
          <p className="text-sm text-muted">
            För att godkänna rekord på topplistan.
          </p>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Lösenord"
            autoComplete="off"
          />
          {error && <p className="text-sm text-warn">{error}</p>}
          <Button type="submit" className="w-full">
            Lås upp
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <SectionTitle>Admin</SectionTitle>

      {admin === false && (
        <p className="card mb-3 px-4 py-3 text-sm text-warn">
          Ditt konto står inte som administratör i databasen, så ändringar
          kommer att avvisas. Lägg till ditt användar-id i tabellen{" "}
          <span className="font-mono">admins</span> i Supabase.
        </p>
      )}

      {error && (
        <p className="card mb-3 px-4 py-3 text-sm text-warn">{error}</p>
      )}

      {lifts.length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Inga lyft att granska än.
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {lifts.map((lift) => (
            <li key={lift.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  {editing === lift.id ? (
                    <TextInput
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className="block truncate font-semibold leading-tight">
                      {lift.display_name}
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {lift.exercise} · {lift.category}
                  </span>
                </span>
                <span className="shrink-0 font-bold tabular-nums">
                  {formatNumber(lift.weight)} kg
                </span>
              </div>

              <div className="mt-2 flex gap-2">
                <Button
                  variant={lift.verified ? "primary" : "secondary"}
                  className="flex-1"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await setVerified(lift.id, !lift.verified);
                      await refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? `Servern avvisade ändringen: ${e.message}`
                          : "Kunde inte ändra.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {lift.verified ? "✓ Godkänt" : "Godkänn"}
                </Button>

                {editing === lift.id ? (
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await renameLifter(lift.id, draftName.trim());
                        setEditing(null);
                        await refresh();
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "Kunde inte spara namnet.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Spara
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(lift.id);
                      setDraftName(lift.display_name);
                    }}
                  >
                    Byt namn
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="ghost"
        className="mt-2 w-full"
        onClick={() => setUnlocked(false)}
      >
        Lås admin
      </Button>
    </>
  );
}
