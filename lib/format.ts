/** Formatering av tid, vikt och datum — svenska format genomgående. */

export function formatWeight(kg: number): string {
  const rounded = Math.round(kg * 100) / 100;
  return `${rounded.toString().replace(".", ",")} kg`;
}

/**
 * Två decimaler som mest, utan onödiga nollor: 27,5 · 3,75 · 31,25 · 15.
 *
 * Måste klara två decimaler — viktplattorna på maskinerna är 1,25 och 3,75 kg,
 * och att avrunda dem till 3,8 gör loggen fel.
 */
export function formatNumber(value: number, maxDecimals = 2): string {
  return String(Number(value.toFixed(maxDecimals))).replace(".", ",");
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}

/** 230 sekunder -> "3:50". Används för löpband och vilotider. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 70 minuter -> "1 h 10 min". För passlängder. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "Idag", "Igår" eller datum — det som är lättast att läsa i en lista. */
export function relativeDay(ts: number): string {
  const day = new Date(ts);
  const today = new Date();
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(day)) / 86_400_000);
  if (diffDays === 0) return "Idag";
  if (diffDays === 1) return "Igår";
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  return formatShortDate(ts);
}

/** Parsar "27,5" och "27.5" lika. Tomt fält ger undefined, inte 0. */
export function parseDecimal(value: string): number | undefined {
  const cleaned = value.replace(",", ".").trim();
  if (cleaned === "") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
