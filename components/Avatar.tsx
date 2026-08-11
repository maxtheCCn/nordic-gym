"use client";

/**
 * Profilbild med initial som standard.
 *
 * Alla får något att synas med direkt — ingen tom grå ruta som väntar på att
 * någon ska orka ladda upp ett foto. Färgen räknas ut från namnet, så samma
 * person får samma färg varje gång och blir lätt att känna igen i listan.
 */

/** Färger valda för att synas mot den mörka bakgrunden. */
const COLORS = [
  "#00d95f",
  "#37a0ff",
  "#ff8a3d",
  "#c471ff",
  "#ffd23d",
  "#ff5d8f",
  "#2ee0c8",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // Versal via toLocaleUpperCase så att å, ä och ö blir rätt.
  return [...trimmed][0].toLocaleUpperCase("sv-SE");
}

export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const color = colorFor(name);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-ink"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.44),
      }}
    >
      {initial(name)}
    </span>
  );
}

/**
 * Krymper en vald bild innan den lämnar telefonen.
 *
 * En kamerabild är 3–5 MB. Som avatar visas den i 40 pixlar. Att skala ner
 * före uppladdning gör att lagringen räcker i praktiken hur länge som helst,
 * och att listan laddar snabbt även på dålig uppkoppling.
 */
export async function shrinkImage(file: File, side = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  // Beskär till en kvadrat från mitten — avatarer visas ändå som cirklar.
  const crop = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - crop) / 2;
  const sy = (bitmap.height - crop) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, sx, sy, crop, crop, 0, 0, side, side);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Kunde inte läsa bilden."))),
      "image/jpeg",
      0.82,
    );
  });
}
