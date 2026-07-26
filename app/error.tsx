"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

/**
 * Visar vad som faktiskt gick sönder.
 *
 * Utan den här sidan svarar Next.js med "Application error: a client-side
 * exception has occurred" och hänvisar till webbläsarkonsolen — vilket är
 * oanvändbart på en telefon. Felmeddelandet går nu att läsa och kopiera direkt,
 * så att ett krasch går att felsöka utan att koppla in enheten i en dator.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const details = [
    error.message || "Okänt fel",
    error.digest ? `digest: ${error.digest}` : "",
    error.stack ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(details);
    } catch {
      const el = document.createElement("textarea");
      el.value = details;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="pb-6 pt-4">
      <h1 className="text-2xl font-bold tracking-tight">Något gick fel</h1>
      <p className="mt-2 text-sm text-muted">
        Din träningsdata är oskadd — den ligger kvar i telefonen. Det är bara
        den här vyn som kraschade.
      </p>

      <div className="card mt-4 px-4 py-3">
        <p className="text-sm font-semibold text-warn">{error.message || "Okänt fel"}</p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted">digest: {error.digest}</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <Button className="w-full" onClick={reset}>
          Försök igen
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={copy}>
            {copied ? "Kopierat ✓" : "Kopiera felet"}
          </Button>
          <Link
            href="/"
            className="tap inline-flex flex-1 items-center justify-center rounded-xl border border-line bg-surface-2 px-4 text-[15px]"
          >
            Till startsidan
          </Link>
        </div>
      </div>

      {error.stack && (
        <details className="card mt-4 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Teknisk detalj
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
