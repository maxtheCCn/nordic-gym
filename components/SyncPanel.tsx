"use client";

import { useCallback, useEffect, useState } from "react";
import { isValidUsername, supabase, syncConfigured, usernameToEmail } from "@/lib/supabase";
import { lastSyncAt, resetSyncState, syncNow } from "@/lib/sync";
import { formatClock, relativeDay } from "@/lib/format";
import { Button, Field, SectionTitle, TextInput } from "./ui";

type Mode = "signin" | "signup";

/**
 * Konto och synk.
 *
 * Inloggningen är avsiktligt så enkel som möjligt: användarnamn och lösenord,
 * ingen mejlbekräftelse. Användarnamnet görs om till en adress på en påhittad
 * domän eftersom Supabase kräver det formatet — se lib/supabase.ts.
 */
export function SyncPanel({ onSynced }: { onSynced: () => Promise<void> }) {
  const [email, setEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const refreshUser = useCallback(async () => {
    const client = supabase();
    if (!client) return;
    const { data } = await client.auth.getUser();
    setEmail(data.user?.email ?? null);
    setSyncedAt(await lastSyncAt());
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const runSync = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await syncNow();
      await onSynced();
      setSyncedAt(result.at);
      setStatus(
        result.pushed === 0 && result.pulled === 0
          ? "Allt är redan i synk."
          : `Skickade ${result.pushed}, hämtade ${result.pulled}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synken misslyckades.");
    } finally {
      setBusy(false);
    }
  }, [onSynced]);

  // Är man redan inloggad när appen öppnas ska datan hämtas utan att man
  // behöver trycka på något.
  useEffect(() => {
    if (!email) return;
    void runSync();
    // Bara vid inloggning, inte vid varje omritning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const client = supabase();
    if (!client) return;

    if (!isValidUsername(username)) {
      setError("Användarnamnet får vara 3–32 tecken: bokstäver, siffror, punkt, bindestreck eller understreck.");
      return;
    }
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const credentials = { email: usernameToEmail(username), password };
      const { error: authError } =
        mode === "signup"
          ? await client.auth.signUp(credentials)
          : await client.auth.signInWithPassword(credentials);

      if (authError) {
        setError(translateAuthError(authError.message, mode));
        return;
      }
      setPassword("");
      await refreshUser();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = supabase();
    if (!client) return;
    setBusy(true);
    await client.auth.signOut();
    // Träningsdatan ligger kvar lokalt — bara synkens minne nollställs, så att
    // nästa konto inte råkar skicka upp den här användarens poster.
    await resetSyncState();
    setEmail(null);
    setStatus(null);
    setBusy(false);
  }

  if (!syncConfigured) {
    return (
      <>
        <SectionTitle>Synk mellan enheter</SectionTitle>
        <p className="card px-4 py-3 text-sm text-muted">
          Inte påslaget. Appen sparar allt i den här webbläsaren. Se
          <span className="font-semibold text-white"> SYNK.md </span>
          i projektet för hur du kopplar på synk.
        </p>
      </>
    );
  }

  if (email) {
    const name = email.replace(/@nwlogg\.local$/, "");
    return (
      <>
        <SectionTitle>Synk mellan enheter</SectionTitle>
        <div className="card space-y-3 p-4">
          <div>
            <p className="font-semibold">Inloggad som {name}</p>
            <p className="text-xs text-muted">
              {syncedAt
                ? `Senast synkad ${relativeDay(syncedAt).toLowerCase()} ${formatClock(syncedAt)}`
                : "Inte synkad än"}
            </p>
          </div>
          {status && <p className="text-sm text-brand">{status}</p>}
          {error && <p className="text-sm text-warn">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={runSync} disabled={busy}>
              {busy ? "Synkar…" : "Synka nu"}
            </Button>
            <Button variant="secondary" onClick={signOut} disabled={busy}>
              Logga ut
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SectionTitle>Synk mellan enheter</SectionTitle>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <p className="text-sm text-muted">
          Logga in så följer maskiner och träningslogg med till alla dina
          enheter. Appen fungerar fortfarande offline — den synkar när du får
          täckning.
        </p>

        <Field label="Användarnamn">
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="max"
          />
        </Field>

        <Field label="Lösenord" hint="Minst 8 tecken.">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </Field>

        {error && <p className="text-sm text-warn">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy
            ? "Ett ögonblick…"
            : mode === "signup"
              ? "Skapa konto"
              : "Logga in"}
        </Button>

        <button
          type="button"
          className="w-full text-sm text-muted underline"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
        >
          {mode === "signup"
            ? "Har du redan ett konto? Logga in"
            : "Har du inget konto? Skapa ett"}
        </button>

        {mode === "signup" && (
          <p className="text-xs text-muted">
            Det finns ingen glömt lösenord-funktion, eftersom du inte anger
            någon mejladress. Välj ett du kommer ihåg — och ta en export då och
            då som säkerhetskopia.
          </p>
        )}
      </form>
    </>
  );
}

/** Supabase svarar på engelska; det här är de fel man faktiskt kan råka ut för. */
function translateAuthError(message: string, mode: Mode): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Användarnamnet är upptaget. Välj ett annat, eller logga in i stället.";
  }
  if (m.includes("invalid login credentials")) {
    return "Fel användarnamn eller lösenord.";
  }
  if (m.includes("email address") && m.includes("invalid")) {
    return "Användarnamnet innehåller tecken som inte fungerar. Använd bara bokstäver, siffror, punkt, bindestreck och understreck.";
  }
  if (m.includes("password")) {
    return "Lösenordet uppfyller inte kraven. Prova ett längre.";
  }
  if (m.includes("confirm")) {
    return "Kontot kräver mejlbekräftelse. Stäng av Confirm email i Supabase — se SYNK.md.";
  }
  return mode === "signup"
    ? `Kunde inte skapa kontot: ${message}`
    : `Kunde inte logga in: ${message}`;
}
