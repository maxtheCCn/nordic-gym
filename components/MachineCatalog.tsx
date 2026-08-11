"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCatalog,
  machineImageUrl,
  publishMachines,
  removeFromCatalog,
  uploadMachineImage,
  type SharedMachine,
} from "@/lib/catalog";
import { listMachines } from "@/lib/db";
import { shrinkImage } from "./Avatar";
import { Button, TextInput } from "./ui";

/**
 * Den gemensamma maskinparken.
 *
 * Maskinerna på gymmet är desamma för alla som tränar där. En administratör
 * publicerar sin egen lista en gång, och alla konton — även de som skapas
 * senare — får den utan att behöva skanna in allt själva.
 */
export function MachineCatalog({ admin }: { admin: boolean | null }) {
  const [catalog, setCatalog] = useState<SharedMachine[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const uploadFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setCatalog(await fetchCatalog());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta katalogen.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function publish() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      // Bara maskiner med riktig QR-kod. Fria vikter och egna tillägg utan kod
      // är personliga och hör inte hemma i den gemensamma parken.
      const mine = (await listMachines()).filter(
        (m) => m.qrRaw && !m.qrKey.startsWith("manuell:"),
      );
      if (mine.length === 0) {
        setError("Du har inga skannade maskiner att publicera än.");
        return;
      }
      const n = await publishMachines(mine);
      await refresh();
      setStatus(`${n} maskiner publicerade till alla.`);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Servern avvisade publiceringen: ${e.message}`
          : "Kunde inte publicera.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setImage(file: File) {
    const qrKey = uploadFor.current;
    if (!qrKey) return;
    setBusy(true);
    setError(null);
    try {
      // 800 px räcker gott — bilden visas i en ruta på ett par hundra pixlar,
      // och en okrympt kamerabild gör katalogen tung på mobildata.
      await uploadMachineImage(qrKey, await shrinkImage(file, 800));
      await refresh();
      setStatus("Bilden är uppladdad.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda upp bilden.");
    } finally {
      uploadFor.current = null;
      setBusy(false);
    }
  }

  const shown = catalog.filter(
    (m) => !filter.trim() || m.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="card mb-3 space-y-3 p-4">
      <div>
        <p className="font-semibold">Gemensam maskinpark</p>
        <p className="mt-0.5 text-sm text-muted">
          {catalog.length === 0
            ? "Tom. Publicera dina skannade maskiner så får alla dem."
            : `${catalog.length} maskiner delas med alla konton.`}
        </p>
      </div>

      <Button className="w-full" onClick={publish} disabled={busy || admin === false}>
        {busy ? "Arbetar…" : "Publicera mina maskiner till alla"}
      </Button>

      {status && <p className="text-sm text-brand">{status}</p>}
      {error && <p className="text-sm text-warn">{error}</p>}

      {catalog.length > 6 && (
        <TextInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Sök maskin"
        />
      )}

      {shown.length > 0 && (
        <ul className="divide-y divide-line">
          {shown.map((m) => {
            const url = machineImageUrl(m.image_path);
            return (
              <li key={m.qr_key} className="flex items-center gap-3 py-2.5">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-xs text-muted">
                    ingen
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold leading-tight">
                    {m.name}
                  </span>
                  <span className="text-xs text-muted">{m.muscle_group}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    uploadFor.current = m.qr_key;
                    fileRef.current?.click();
                  }}
                  className="tap shrink-0 rounded-lg border border-line px-3 text-xs font-semibold active:bg-surface-2"
                >
                  {url ? "Byt bild" : "Bild"}
                </button>
                <button
                  type="button"
                  aria-label={`Ta bort ${m.name} ur katalogen`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await removeFromCatalog(m.qr_key);
                      await refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Kunde inte ta bort.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="tap w-8 shrink-0 rounded-lg text-muted active:bg-surface-2"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void setImage(f);
          e.target.value = "";
        }}
      />

      <p className="text-xs text-muted">
        Bara maskiner med QR-kod publiceras. Fria vikter och egna tillägg är
        personliga och delas inte. Att ta bort ur katalogen rör ingens logg —
        bara vad nya konton får från början.
      </p>
    </div>
  );
}
