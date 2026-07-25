"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Scanner } from "@/components/Scanner";
import { PageHeader, Spinner } from "@/components/ui";
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
        <Scanner onResult={handleResult} />
      )}
    </div>
  );
}
