"use client";

import { useState } from "react";
import {
  checkInviteCode,
  isValidUsername,
  supabase,
  usernameToEmail,
} from "@/lib/supabase";
import { Button, Field, TextInput } from "./ui";

type Mode = "signup" | "signin";

/**
 * Första skärmen i appen när ingen är inloggad.
 *
 * Inloggningen sker en gång. Sessionen sparas i telefonen och förnyas i
 * bakgrunden, så den här skärmen ska man i praktiken bara se en gång per
 * enhet — därefter öppnas appen direkt i träningsläget.
 */
export function AuthScreen({
  onSignedIn,
  onSkip,
}: {
  onSignedIn: () => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const client = supabase();
    if (!client) return;

    if (!isValidUsername(username)) {
      setError(
        "Användarnamnet får vara 3–32 tecken: bokstäver, siffror, punkt, bindestreck eller understreck.",
      );
      return;
    }
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        // Kontrolleras före registreringen — annars skapas kontot och koden
        // blir en meningslös formalitet efteråt.
        const ok = await checkInviteCode(invite);
        if (!ok) {
          setError("Fel inbjudningskod. Fråga den som satt upp appen.");
          return;
        }
      }

      const credentials = { email: usernameToEmail(username), password };
      const { error: authError } =
        mode === "signup"
          ? await client.auth.signUp(credentials)
          : await client.auth.signInWithPassword(credentials);

      if (authError) {
        setError(translate(authError.message, mode));
        return;
      }
      onSignedIn();
    } catch {
      // Nätverksfel snarare än fel lösenord. Utan väg vidare vore appen låst
      // för den som står i en gymkällare utan täckning.
      setOffline(true);
      setError(
        "Kunde inte nå servern. Kontrollera din anslutning — första inloggningen kräver internet.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col justify-center py-8">
      <div className="mb-8 text-center">
        <svg
          viewBox="0 0 512 512"
          className="mx-auto mb-4 w-20"
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="34"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M150 256h212" />
          <path d="M150 196v120M362 196v120" />
          <path d="M104 226v60M408 226v60" />
        </svg>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          Nordic Wellness
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Träningslogg</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          {mode === "signup"
            ? "Skapa ett konto så följer din träning med mellan alla dina enheter."
            : "Logga in för att hämta din träningslogg."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
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

        <Field label="Lösenord" hint={mode === "signup" ? "Minst 8 tecken." : undefined}>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </Field>

        {mode === "signup" && (
          <Field label="Inbjudningskod" hint="Fråga den som satt upp appen.">
            <TextInput
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Koden du fått"
            />
          </Field>
        )}

        {error && (
          <p className="rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-3 text-sm text-warn">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy
            ? "Ett ögonblick…"
            : mode === "signup"
              ? "Skapa konto"
              : "Logga in"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-muted underline"
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
        <p className="mt-6 text-xs text-muted">
          Det finns ingen glömt lösenord-funktion, eftersom du inte anger någon
          mejladress. Välj ett du kommer ihåg.
        </p>
      )}

      {/*
        Visas först när servern faktiskt inte gick att nå. En permanent
        "hoppa över" hade urholkat poängen med konton, men utan någon väg alls
        blir appen oanvändbar den dag Supabase ligger nere — och då står man
        vid en maskin och kan inte logga sitt set.
      */}
      {offline && (
        <button
          type="button"
          className="mt-6 text-sm text-muted underline"
          onClick={onSkip}
        >
          Fortsätt utan konto tills vidare
        </button>
      )}
    </div>
  );
}

/** Supabase svarar på engelska; det här är felen man faktiskt råkar ut för. */
function translate(message: string, mode: Mode): string {
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
    return "Kontot kräver mejlbekräftelse. Stäng av Confirm email i Supabase.";
  }
  return mode === "signup"
    ? `Kunde inte skapa kontot: ${message}`
    : `Kunde inte logga in: ${message}`;
}
