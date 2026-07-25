"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";

/* ------------------------------------------------------------- rubriker */

export function PageHeader({
  title,
  subtitle,
  back = true,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="mb-5 flex items-start gap-3">
      {back && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Tillbaka"
          className="tap -ml-2 flex w-10 items-center justify-center rounded-xl text-muted active:bg-surface-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-muted">
      {children}
    </h2>
  );
}

/* -------------------------------------------------------------- knappar */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
};

const VARIANTS: Record<string, string> = {
  primary: "bg-brand text-ink font-bold active:bg-brand-dim disabled:bg-line disabled:text-muted",
  secondary: "bg-surface-2 text-white border border-line active:bg-line",
  ghost: "text-muted active:bg-surface-2",
  danger: "bg-red-500/15 text-red-400 border border-red-500/30 active:bg-red-500/25",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  // Utan detta blir varje knapp inuti ett formulär en submit-knapp.
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl px-4 transition-colors disabled:opacity-60 ${
        size === "lg" ? "min-h-14 text-lg" : "text-[15px]"
      } ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl px-4 text-[15px] transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* --------------------------------------------------------------- fälten */

/**
 * Etikett + kontroll.
 *
 * Medvetet INTE ett <label>: fälten innehåller ofta flera kontroller (stepperns
 * +/- knappar, chip-rader). En <label> runt en knapp är ogiltig HTML och gör att
 * webbläsaren skickar klicket vidare till fältets input i stället för till
 * knappen — knapparna slutar helt enkelt fungera. En namngiven grupp ger samma
 * koppling för skärmläsare utan att kapa klicken.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="block">
      <span id={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={id}>
        {children}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </div>
  );
}

const INPUT =
  "tap w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-base text-white outline-none placeholder:text-muted/60 focus:border-brand";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT} min-h-24 ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT} appearance-none ${props.className ?? ""}`} />;
}

/**
 * Stort sifferfält med +/- på sidorna.
 *
 * Hela poängen: med svettiga händer mellan set ska du kunna ändra vikt utan
 * att öppna tangentbordet. Fältet går ändå att skriva i om steget inte räcker.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
  decimals = false,
}: {
  value: number;
  onChange: React.Dispatch<React.SetStateAction<number>>;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  decimals?: boolean;
}) {
  const clamp = (n: number) => {
    const bounded = Math.min(max ?? Infinity, Math.max(min, n));
    return Math.round(bounded * 100) / 100;
  };

  /**
   * Räknar från det senaste värdet, inte från det som råkade vara renderat.
   * Trycker man snabbt flera gånger hinner React batcha uppdateringarna, och
   * med ett värde beräknat i förväg tappas alla tryck utom ett.
   */
  const bump = (delta: number) => onChange((current) => clamp(current + delta));

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label="Minska"
        onClick={() => bump(-step)}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-2xl font-bold text-white active:bg-line"
      >
        −
      </button>
      <div className="relative flex-1">
        <input
          inputMode={decimals ? "decimal" : "numeric"}
          value={decimals ? String(value).replace(".", ",") : value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(n)) onChange(clamp(n));
            else if (e.target.value === "") onChange(min);
          }}
          onFocus={(e) => e.target.select()}
          className="h-14 w-full rounded-xl border border-line bg-surface-2 text-center text-2xl font-bold tabular-nums text-white outline-none focus:border-brand"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="Öka"
        onClick={() => bump(step)}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-2xl font-bold text-white active:bg-line"
      >
        +
      </button>
    </div>
  );
}

/** Rad med val där bara ett kan vara aktivt — t.ex. extra viktplatta. */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: T[];
  value: T;
  onChange: (next: T) => void;
  render?: (option: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            className={`tap rounded-xl border px-4 text-[15px] font-semibold transition-colors ${
              active
                ? "border-brand bg-brand/15 text-brand"
                : "border-line bg-surface-2 text-white active:bg-line"
            }`}
          >
            {render ? render(option) : String(option)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- övrigt */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Spinner({ label = "Laddar…" }: { label?: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted" role="status">
      {label}
    </p>
  );
}
