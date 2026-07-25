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
/** Hints delas av live-skanning och fotoavkodning. */
function scannerHints() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  // Life Fitness-koderna är långa (~144 tecken) och därmed täta. TRY_HARDER
  // låter ZXing göra fler och dyrare avkodningsförsök, vilket krävs när koden
  // är liten i bild, blank av plast eller dåligt belyst.
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

export function Scanner({ onResult }: { onResult: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Ref, inte state: callbacken från ZXing fyras av många gånger per sekund
  // och får inte hinna leverera samma kod två gånger innan state hunnit sätta.
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Vad kameran faktiskt gav oss. Utan detta går det inte att skilja
  // "kameran startade aldrig" från "kameran går men koden är för liten i bild".
  const [diag, setDiag] = useState<{
    attempt: string;
    width?: number | null;
    height?: number | null;
    camera?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hints = scannerHints();

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
    });

    /*
     * Tre försök, från mest till minst kräsen. Ber man om full HD och kameran
     * inte klarar exakt det svarar vissa enheter med OverconstrainedError i
     * stället för att ge något sämre — då är det bättre att backa än att stå
     * utan kamera helt.
     */
    const attempts: { label: string; video: MediaTrackConstraints }[] = [
      {
        /*
         * Klistermärket är bara ~3 cm brett och koden tät. Ju fler pixlar per
         * ruta desto större chans att den går att läsa på ett avstånd där
         * kameran faktiskt får skärpa — därför frågar vi efter 4K först.
         */
        label: "4K bakkamera",
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      },
      {
        label: "1920×1080 bakkamera",
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      },
      {
        label: "1280×720 bakkamera",
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { label: "bakkamera utan krav", video: { facingMode: "environment" } },
      { label: "valfri kamera", video: true as unknown as MediaTrackConstraints },
    ];

    (async () => {
      let lastError: DOMException | null = null;

      for (const attempt of attempts) {
        if (cancelled) return;
        try {
          const controls = await reader.decodeFromConstraints(
            { video: attempt.video },
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
          const settings = track?.getSettings?.();
          setDiag({
            attempt: attempt.label,
            width: settings?.width ?? null,
            height: settings?.height ?? null,
            camera: settings?.facingMode ?? track?.label ?? "okänd",
          });
          if (track && "torch" in (track.getCapabilities?.() ?? {})) {
            setTorchAvailable(true);
          }
          return;
        } catch (e) {
          lastError = e as DOMException;
          // NotAllowedError är ett nej från användaren eller systemet —
          // att försöka igen med lägre krav ändrar ingenting.
          if (lastError?.name === "NotAllowedError") break;
        }
      }

      if (cancelled) return;

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;

      setDiag({
        attempt: "alla misslyckades",
        error: `${lastError?.name ?? "Okänt fel"}: ${lastError?.message ?? ""}`,
      });

      setError(
        lastError?.name === "NotAllowedError" && standalone
          ? "Kameran blockeras när appen körs från hemskärmen. Öppna sidan i Safari i stället — där fungerar skanningen."
          : lastError?.name === "NotAllowedError"
            ? "Kameran är blockerad. Tillåt kameraåtkomst för sidan i webbläsarens inställningar."
            : lastError?.name === "NotFoundError"
              ? "Ingen kamera hittades på enheten."
              : "Kunde inte starta kameran. Kontrollera att sidan körs över https.",
      );
      setShowManual(true);
    })();

    // Låser sig avkodningen ska man få ett konkret råd, inte stirra på en
    // kamerabild som inte gör något.
    const hintTimer = setTimeout(() => {
      if (!cancelled && !doneRef.current) setStuck(true);
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      controlsRef.current?.stop();
    };
  }, [onResult]);

  /**
   * Avkodar ett foto i stället för videoströmmen.
   *
   * Det här är den pålitliga vägen på iPhone: Safaris getUserMedia varken
   * växlar till makroobjektivet eller tvingar fram omfokusering, så på det
   * avstånd som krävs för en tät kod blir videobilden suddig. iOS egna
   * kameragränssnitt fixar både skärpa och full sensorupplösning, och en
   * stillbild kan dessutom avkodas långsamt och noggrant.
   */
  async function decodePhoto(file: File) {
    setPhotoBusy(true);
    setPhotoError(null);
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader(scannerHints());
      const result = await reader.decodeFromImageUrl(url);
      navigator.vibrate?.(60);
      doneRef.current = true;
      controlsRef.current?.stop();
      onResult(result.getText());
    } catch {
      setPhotoError(
        "Hittade ingen QR-kod i bilden. Ta om den närmare, så att koden fyller " +
          "större delen av bilden och är skarp.",
      );
    } finally {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    }
  }

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
      ) : stuck ? (
        <p className="card px-4 py-3 text-sm text-muted">
          Läser den inte av? Kameran i webbläsaren ställer inte om skärpan lika
          bra som kamera-appen, och koderna på maskinerna är täta. Tryck{" "}
          <span className="font-semibold text-white">Ta foto av koden</span>{" "}
          nedan — då används telefonens riktiga kamera, och det brukar lösa det.
        </p>
      ) : (
        <p className="text-center text-sm text-muted">
          Rikta kameran mot QR-koden på maskinen
        </p>
      )}

      {/*
        `capture="environment"` öppnar kameran direkt i stället för
        bildbiblioteket. Att gå omvägen via ett foto låter iOS sköta makrofokus
        och ger full sensorupplösning — vilket videoströmmen inte gör.
      */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void decodePhoto(file);
          e.target.value = "";
        }}
      />
      <Button
        size="lg"
        className="w-full"
        disabled={photoBusy}
        onClick={() => photoRef.current?.click()}
      >
        {photoBusy ? "Läser av bilden…" : "Ta foto av koden"}
      </Button>

      {photoError && (
        <p className="card px-4 py-3 text-sm text-warn">{photoError}</p>
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

      {/* Gör felsökning möjlig utan att koppla in telefonen i en dator. */}
      <details className="card px-4 py-3 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-white">
          Teknisk info
        </summary>
        <dl className="mt-2 space-y-1">
          <Row label="Läge">
            {typeof window !== "undefined" &&
            (window.matchMedia("(display-mode: standalone)").matches ||
              (window.navigator as { standalone?: boolean }).standalone === true)
              ? "Hemskärm (standalone)"
              : "Webbläsare"}
          </Row>
          <Row label="Säker anslutning">
            {typeof window !== "undefined" && window.isSecureContext
              ? "ja (https)"
              : "NEJ — kameran kräver https"}
          </Row>
          <Row label="Kamera-API">
            {typeof navigator !== "undefined" && navigator.mediaDevices
              ? "finns"
              : "SAKNAS"}
          </Row>
          <Row label="Försök">{diag?.attempt ?? "startar…"}</Row>
          <Row label="Upplösning">
            {diag?.width ? `${diag.width}×${diag.height}` : "—"}
          </Row>
          <Row label="Kamera">{diag?.camera ?? "—"}</Row>
          {diag?.error && <Row label="Fel">{diag.error}</Row>}
        </dl>
      </details>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-white">{children}</dd>
    </div>
  );
}
