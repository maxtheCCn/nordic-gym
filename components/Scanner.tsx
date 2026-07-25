"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useEffect, useRef, useState } from "react";
import { Button, TextInput } from "./ui";

/**
 * Kameraskanner för QR-koderna på maskinerna.
 *
 * Söker bara efter QR — att begränsa formaten gör avkodningen märkbart
 * snabbare, vilket spelar roll när man står och riktar telefonen mot en
 * maskin med dålig belysning.
 */
export function Scanner({ onResult }: { onResult: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Ref, inte state: callbacken från ZXing fyras av många gånger per sekund
  // och får inte hinna leverera samma kod två gånger innan state hunnit sätta.
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    const reader = new BrowserMultiFormatReader(hints);

    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result) => {
            if (!result || doneRef.current) return;
            doneRef.current = true;
            navigator.vibrate?.(60);
            controlsRef.current?.stop();
            onResult(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;

        const stream = videoRef.current?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        if (track && "torch" in (track.getCapabilities?.() ?? {})) {
          setTorchAvailable(true);
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as DOMException;
        setError(
          err?.name === "NotAllowedError"
            ? "Kameran är blockerad. Tillåt kameraåtkomst för sidan i webbläsarens inställningar."
            : err?.name === "NotFoundError"
              ? "Ingen kamera hittades på enheten."
              : "Kunde inte starta kameran. Kontrollera att sidan körs över https.",
        );
        setShowManual(true);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onResult]);

  async function toggleTorch() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        // `torch` finns i webbläsarna men saknas i TypeScripts DOM-typer.
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />
        {/* Siktram — hjälper användaren att hålla rätt avstånd. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-2xl border-2 border-brand/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {torchAvailable && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute bottom-3 right-3 rounded-xl px-3 py-2 text-sm font-semibold ${
              torchOn ? "bg-brand text-ink" : "bg-black/60 text-white"
            }`}
          >
            {torchOn ? "Lampa på" : "Lampa"}
          </button>
        )}
      </div>

      {error ? (
        <p className="card px-4 py-3 text-sm text-warn">{error}</p>
      ) : (
        <p className="text-center text-sm text-muted">
          Rikta kameran mot QR-koden på maskinen
        </p>
      )}

      {showManual ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onResult(manual.trim());
          }}
        >
          <TextInput
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Klistra in QR-länken"
            autoComplete="off"
          />
          <Button type="submit" className="w-full" disabled={!manual.trim()}>
            Använd länken
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowManual(true)}
        >
          Skanningen fungerar inte — skriv in manuellt
        </Button>
      )}
    </div>
  );
}
