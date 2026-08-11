"use client";

import { useCallback, useEffect, useState } from "react";
import { isDemo } from "@/lib/demo";
import { supabase, syncConfigured } from "@/lib/supabase";
import { AuthScreen } from "./AuthScreen";

const SKIP_KEY = "nw-skip-auth";

/**
 * Släpper in i appen först när någon är inloggad.
 *
 * Sessionen läses lokalt, inte över nätet — annars hade appen vägrat öppna i
 * en gymkällare utan täckning. Supabase sparar sessionen i telefonen och
 * förnyar den i bakgrunden, så inloggningen sker i praktiken en gång per
 * enhet.
 *
 * Demoläget och en app utan konfigurerad server går alltid förbi: där finns
 * ingen inloggning att göra.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"laddar" | "inne" | "ute">("laddar");

  /** Sant när inloggning inte är aktuell över huvud taget. */
  const bypassed = useCallback(
    () =>
      !syncConfigured ||
      isDemo() ||
      window.localStorage.getItem(SKIP_KEY) === "1",
    [],
  );

  const check = useCallback(async () => {
    if (bypassed()) {
      setState("inne");
      return;
    }
    const client = supabase();
    if (!client) {
      setState("inne");
      return;
    }
    // getSession läser det som sparats lokalt. getUser hade gått mot nätet
    // och låst ute den som är offline.
    const { data } = await client.auth.getSession();
    setState(data.session ? "inne" : "ute");
  }, [bypassed]);

  useEffect(() => {
    void check();

    // I demoläget finns ingen inloggning att bevaka. Utan den här spärren
    // fyrar lyssnaren av direkt vid uppkoppling, hittar ingen session och
    // kastar ut demoanvändaren till inloggningen.
    if (bypassed()) return;

    const client = supabase();
    if (!client) return;
    // Loggar man ut i inställningarna ska man hamna på inloggningen direkt.
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (session || bypassed()) setState("inne");
      else setState("ute");
    });
    return () => sub.subscription.unsubscribe();
  }, [check, bypassed]);

  // Ingen skärm alls medan sessionen läses — annars blinkar inloggningen
  // förbi varje gång appen öppnas.
  if (state === "laddar") return null;

  if (state === "ute") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pt-5">
        <AuthScreen
          onSignedIn={() => setState("inne")}
          onSkip={() => {
            window.localStorage.setItem(SKIP_KEY, "1");
            setState("inne");
          }}
        />
      </main>
    );
  }

  return <>{children}</>;
}

/** Rensar undantaget, så att inloggningen krävs igen efter en utloggning. */
export function clearAuthSkip() {
  window.localStorage.removeItem(SKIP_KEY);
}
