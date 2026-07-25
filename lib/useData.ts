"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getActiveSession,
  getProfile,
  listGyms,
  listMachines,
  listSessions,
  listSets,
} from "./db";
import type { Gym, Machine, Profile, Session, SetEntry } from "./types";

export interface AppData {
  gyms: Gym[];
  machines: Machine[];
  sessions: Session[];
  sets: SetEntry[];
  profile: Profile;
  activeSession: Session | undefined;
}

const EMPTY: AppData = {
  gyms: [],
  machines: [],
  sessions: [],
  sets: [],
  profile: { id: "profile" },
  activeSession: undefined,
};

/**
 * Laddar hela databasen till minnet.
 *
 * Det låter tungt men är det inte: även efter flera år av träning handlar det
 * om några tusen rader. Att ha allt i minnet gör att statistik och rapporter
 * kan räknas fram direkt, utan väntan mellan sidorna.
 */
export function useData() {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [gyms, machines, sessions, sets, profile, activeSession] =
        await Promise.all([
          listGyms(),
          listMachines(),
          listSessions(),
          listSets(),
          getProfile(),
          getActiveSession(),
        ]);
      setData({ gyms, machines, sessions, sets, profile, activeSession });
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Kunde inte läsa den lokala databasen.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** Tickar en gång i sekunden. Används av löpande timers (pass, vila). */
export function useTicker(active: boolean, intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
