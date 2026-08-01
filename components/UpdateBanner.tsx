"use client";

import { useCallback, useEffect, useState } from "react";

const BUILT_AT = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

/**
 * Laddar om appen och går förbi cachen.
 *
 * En vanlig `reload()` kan servera samma cachade HTML igen, och då hämtas
 * aldrig den nya koden. Med en engångsparameter i adressen tvingas en färsk
 * hämtning, och den nya HTML:en pekar i sin tur på de nya skriptfilerna.
 */
export function reloadFresh() {
  const url = new URL(window.location.href);
  url.searchParams.set("uppdaterad", String(Date.now()));
  window.location.replace(url.toString());
}

/** Hämtar versionen som ligger på servern just nu, utan att gå via cachen. */
async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const res = await fetch(`${base}/version.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json())?.buildTime ?? null;
  } catch {
    return null;
  }
}

/**
 * Talar om när en nyare version finns.
 *
 * På hemskärmen på iPhone finns varken adressfält, uppdateringsknapp eller
 * dra-för-att-ladda-om. Utan den här kontrollen kan man köra en månad gammal
 * version utan att veta om det, och utan något sätt att göra något åt det.
 */
export function UpdateBanner() {
  const [newer, setNewer] = useState(false);

  const check = useCallback(async () => {
    if (!BUILT_AT) return;
    const deployed = await fetchDeployedVersion();
    if (deployed && deployed !== BUILT_AT) setNewer(true);
  }, []);

  useEffect(() => {
    void check();
    // Kolla också när appen tas fram igen — den ligger ofta kvar i bakgrunden
    // i dagar utan att sidan laddas om.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  if (!newer) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-brand px-4 py-2 text-ink">
      <span className="text-sm font-bold">Ny version finns</span>
      <button
        type="button"
        onClick={reloadFresh}
        className="shrink-0 rounded-lg bg-ink/15 px-3 py-1 text-sm font-bold active:bg-ink/25"
      >
        Uppdatera
      </button>
    </div>
  );
}

/** Byggversionen i läsbar form, för inställningssidan. */
export function buildLabel(): string {
  if (!BUILT_AT) return "okänd";
  return new Date(BUILT_AT).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
