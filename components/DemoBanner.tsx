"use client";

import { useEffect, useState } from "react";
import { exitDemo, isDemo } from "@/lib/demo";

/**
 * Alltid synlig påminnelse om att man är i demoläget.
 *
 * Utan den är risken att man loggar ett riktigt pass i demot och tror att det
 * sparats — och den träningen finns då ingenstans i den riktiga loggen.
 */
export function DemoBanner() {
  // Läses efter montering: localStorage finns inte när sidan byggs.
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemo()), []);

  if (!demo) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-warn px-4 py-2 text-ink">
      <span className="text-sm font-bold">
        Demoläge — inget sparas i din riktiga logg
      </span>
      <button
        type="button"
        onClick={exitDemo}
        className="shrink-0 rounded-lg bg-ink/15 px-3 py-1 text-sm font-bold active:bg-ink/25"
      >
        Avsluta
      </button>
    </div>
  );
}
