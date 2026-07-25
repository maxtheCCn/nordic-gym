"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/** Hints delas av live-skanning och fotoavkodning. */
export function scannerHints() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  // Koderna på maskinerna är långa (~144 tecken) och därmed täta. TRY_HARDER
  // låter ZXing göra fler och dyrare försök, vilket krävs när koden är liten i
  // bild, blank av plast eller dåligt belyst.
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

/**
 * Försöker med webbläsarens inbyggda streckkodsläsare först.
 *
 * Där den finns är den klart bättre än ZXing — på Apples plattformar är det
 * samma motor som kamera-appen använder. Safari exponerar den inte i dagsläget,
 * men det kostar ingenting att fråga, och den dagen den dyker upp blir
 * avläsningen bättre utan att något behöver skrivas om.
 */
async function tryNativeDetector(
  source: CanvasImageSource,
): Promise<string | null> {
  const Ctor = (
    window as unknown as {
      BarcodeDetector?: new (opts?: {
        formats?: string[];
      }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const detector = new Ctor({ formats: ["qr_code"] });
    const found = await detector.detect(source);
    return found?.[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

/** Ritar en centrerad beskärning av bilden, skalad, till en canvas. */
function render(
  bitmap: ImageBitmap,
  cropFraction: number,
  maxSide: number,
): HTMLCanvasElement {
  const cropW = bitmap.width * cropFraction;
  const cropH = bitmap.height * cropFraction;
  const sx = (bitmap.width - cropW) / 2;
  const sy = (bitmap.height - cropH) / 2;

  const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Läser en QR-kod ur ett foto.
 *
 * Ett enda försök på originalbilden räcker inte. Ett mobilfoto är 8–12
 * megapixel och koden upptar ofta en liten del av det; ZXings sökning efter
 * lägesmarkörer tappar bort sig i bruset. Fotograferar man dessutom en skärm
 * tillkommer moaré som stör ytterligare.
 *
 * Därför provas flera varianter: nedskalning tar bort brus och moaré, och
 * centrerade beskärningar gör koden proportionellt större i bilden. Första
 * träffen vinner.
 */
export interface DecodeOutcome {
  text: string | null;
  /** Kort beskrivning av bilden, så att ett misslyckande går att felsöka. */
  info: string;
}

export async function decodeImageFile(file: File): Promise<DecodeOutcome> {
  const sizeKb = Math.round(file.size / 1024);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      text: null,
      info: `${file.type || "okänt format"}, ${sizeKb} kB — bilden gick inte att öppna`,
    };
  }

  const info = `${bitmap.width}×${bitmap.height}, ${file.type || "okänt format"}, ${sizeKb} kB`;

  try {
    const native = await tryNativeDetector(bitmap);
    if (native) return { text: native, info: `${info} (inbyggd läsare)` };

    const reader = new BrowserMultiFormatReader(scannerHints());

    // Beskärning × maxstorlek. Ordnade så att de billigaste och mest
    // sannolika kommer först.
    const variants: [crop: number, maxSide: number][] = [
      [1, 1600],
      [1, 2600],
      [0.6, 1600],
      [1, 900],
      [0.4, 1200],
      [0.75, 2200],
    ];

    for (const [crop, maxSide] of variants) {
      const canvas = render(bitmap, crop, maxSide);
      try {
        const result = reader.decodeFromCanvas(canvas);
        const text = result?.getText();
        if (text) {
          return {
            text,
            info: `${info} (beskärning ${Math.round(crop * 100)} %, ${canvas.width} px)`,
          };
        }
      } catch {
        // NotFoundException för just den varianten — prova nästa.
      }
    }
    return { text: null, info: `${info} — ingen kod hittades` };
  } finally {
    bitmap.close?.();
  }
}
