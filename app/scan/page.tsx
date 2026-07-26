"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { Scanner } from "@/components/Scanner";
import { Button, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { findMachineByQr, listMachines } from "@/lib/db";
import type { Machine } from "@/lib/types";

export default function ScanPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ScanFlow />
    </Suspense>
  );
}

function ScanFlow() {
  const router = useRouter();
  const params = useSearchParams();
  /** Maskinen passet säger att du ska stå vid. Tomt vid vanlig skanning. */
  const expect = params.get("expect") ?? "";

  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState<Machine | null>(null);

  const openMachine = useCallback(
    (id: string) => router.replace(`/machine?id=${id}`),
    [router],
  );

  const handleResult = useCallback(
    async (raw: string) => {
      setBusy(true);
      const machine = await findMachineByQr(raw);

      if (!machine) {
        // Okänd kod. Väntar passet på en viss maskin följer namnet med, så
        // att registreringen blir ett steg i stället för ett sidospår.
        const name = expect ? `&name=${encodeURIComponent(expect)}` : "";
        router.replace(`/machine/new?qr=${encodeURIComponent(raw)}${name}`);
        return;
      }

      const matches =
        !expect ||
        machine.name.trim().toLowerCase() === expect.trim().toLowerCase();

      if (matches) {
        openMachine(machine.id);
        return;
      }

      // Rätt kod, fel maskin enligt passet. Att bara fortsätta hade loggat
      // träningen på fel maskin utan att någon märkte det.
      setMismatch(machine);
      setBusy(false);
    },
    [expect, openMachine, router],
  );

  /**
   * Maskiner utan QR-kod: skivstänger, bänkar, hantlar. Finns maskinen redan
   * i loggen går vi direkt dit, annars till registrering med namnet ifyllt.
   */
  async function skipScan() {
    setBusy(true);
    if (!expect) {
      router.push("/machines");
      return;
    }
    const machines = await listMachines();
    const found = machines.find(
      (m) => m.name.trim().toLowerCase() === expect.trim().toLowerCase(),
    );
    if (found) openMachine(found.id);
    else router.replace(`/machine/new?name=${encodeURIComponent(expect)}`);
  }

  if (mismatch) {
    return (
      <div>
        <PageHeader title="Fel maskin?" />
        <div className="card px-4 py-4">
          <p className="text-sm text-muted">Du skannade</p>
          <p className="text-xl font-bold">{mismatch.name}</p>
          <p className="mt-3 text-sm text-muted">Passet säger</p>
          <p className="text-xl font-bold text-brand">{expect}</p>
        </div>
        <div className="mt-4 space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setMismatch(null)}
          >
            Skanna om
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => openMachine(mismatch.id)}
          >
            Logga på {mismatch.name} ändå
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted">
          Heter maskinen något annat på ditt gym kan du döpa om den under
          Välj maskin, så slipper du frågan nästa gång.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={expect || "Skanna maskin"}
        subtitle={
          expect
            ? "Skanna maskinens QR-kod så vet appen att du står rätt"
            : "Koden sitter oftast på maskinens ram eller display"
        }
      />
      {busy ? (
        <Spinner label="Öppnar maskinen…" />
      ) : (
        <>
          <Scanner onResult={handleResult} />
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full" onClick={skipScan}>
              {expect
                ? "Maskinen har ingen QR-kod"
                : "Välj maskin i listan i stället"}
            </Button>
            {!expect && (
              <LinkButton href="/machine/new" className="w-full">
                Ny maskin utan QR-kod
              </LinkButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}
