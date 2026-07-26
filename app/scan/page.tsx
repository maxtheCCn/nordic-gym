"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Scanner } from "@/components/Scanner";
import { LinkButton, PageHeader, Spinner } from "@/components/ui";
import { findMachineByQr } from "@/lib/db";

export default function ScanPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleResult = useCallback(
    async (raw: string) => {
      setBusy(true);
      const machine = await findMachineByQr(raw);
      if (machine) {
        // Känd maskin -> rakt in i loggningen. Noll extra tryck.
        router.replace(`/machine?id=${machine.id}`);
      } else {
        // Okänd kod -> registrera den en gång, sedan känns den igen för alltid.
        router.replace(`/machine/new?qr=${encodeURIComponent(raw)}`);
      }
    },
    [router],
  );

  return (
    <div>
      <PageHeader
        title="Skanna maskin"
        subtitle="Koden sitter oftast på maskinens ram eller display"
      />
      {busy ? (
        <Spinner label="Öppnar maskinen…" />
      ) : (
        <>
          <Scanner onResult={handleResult} />
          {/* Står man framför ett löpband finns ingen kod att skanna. */}
          <div className="mt-4 flex gap-2">
            <LinkButton href="/machines" className="flex-1">
              Välj i listan
            </LinkButton>
            <LinkButton href="/machine/new" className="flex-1">
              Ny utan QR-kod
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
