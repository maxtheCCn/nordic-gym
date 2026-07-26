"use client";

import { useEffect, useState } from "react";

/** Måste matcha den sammanlagda animationstiden i globals.css. */
const DURATION_MS = 1650;

/**
 * Kort introanimation med appens hantel, i stil med Netflix logotypsekvens.
 *
 * Medvetet snabb och avbrytbar. Appen används mitt i ett träningspass, där
 * varje sekund mellan "öppna" och "skanna" är ren väntetid — en intro som
 * inte går att hoppa över skulle motarbeta hela poängen med appen.
 *
 * Ligger i layouten och spelar därför bara vid riktig appstart, inte när man
 * byter flik inne i appen.
 */
export function SplashIntro() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Har användaren bett systemet om mindre rörelse hoppas introt helt över.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDone(true);
      return;
    }
    const timer = setTimeout(() => setDone(true), DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div
      className="splash"
      // Ett tryck var som helst hoppar över resten.
      onPointerDown={() => setDone(true)}
      aria-hidden="true"
    >
      <div className="splash-stage">
        <svg viewBox="0 0 512 512" className="splash-mark">
          <g
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="34"
            strokeLinecap="round"
          >
            <path className="splash-bar" d="M150 256h212" />
            <path className="splash-plate-inner" d="M150 196v120" />
            <path className="splash-plate-inner" d="M362 196v120" />
            <path className="splash-plate-outer" d="M104 226v60" />
            <path className="splash-plate-outer" d="M408 226v60" />
          </g>
        </svg>
        <span className="splash-sweep" />
      </div>
      <p className="splash-word">NW LOGG</p>
    </div>
  );
}
