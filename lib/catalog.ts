"use client";

import { currentGym, listMachines, saveMachine } from "./db";
import { supabase } from "./supabase";
import type { Machine, MachineType, Metric, MuscleGroup } from "./types";

/** En maskin i den gemensamma parken, som den ser ut på servern. */
export interface SharedMachine {
  id: string;
  qr_key: string;
  qr_raw: string | null;
  name: string;
  muscle_group: string;
  type: string;
  metrics: Metric[];
  plate_options: number[];
  weight_step: number;
  target_sets: number | null;
  note: string | null;
  image_path: string | null;
  updated_at: number;
}

export async function fetchCatalog(): Promise<SharedMachine[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from("shared_machines")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SharedMachine[];
}

/**
 * Hämtar hem den gemensamma parken till den egna loggen.
 *
 * Maskiner man redan har rörs inte — varken namn, inställningar eller
 * historik. Det som saknas läggs till, matchat på QR-nyckeln, så att en maskin
 * man själv skannat inte får en dubblett från katalogen.
 */
export async function pullCatalog(): Promise<number> {
  const shared = await fetchCatalog();
  if (shared.length === 0) return 0;

  const mine = await listMachines();
  const gym = await currentGym();
  const keys = new Set(mine.map((m) => m.qrKey));
  const names = new Set(mine.map((m) => m.name.trim().toLowerCase()));

  let added = 0;
  for (const s of shared) {
    if (keys.has(s.qr_key) || names.has(s.name.trim().toLowerCase())) continue;
    await saveMachine({
      qrKey: s.qr_key,
      qrRaw: s.qr_raw ?? "",
      gymId: gym.id,
      name: s.name,
      muscleGroup: s.muscle_group as MuscleGroup,
      type: s.type as MachineType,
      metrics: s.metrics,
      plateOptions: s.plate_options,
      weightStep: s.weight_step,
      targetSets: s.target_sets ?? 3,
      note: s.note ?? undefined,
      imagePath: s.image_path ?? undefined,
      deletedAt: null,
    });
    keys.add(s.qr_key);
    names.add(s.name.trim().toLowerCase());
    added++;
  }
  return added;
}

/**
 * Publicerar de egna maskinerna till den gemensamma parken.
 *
 * Bara administratörer släpps igenom av databasen. Maskiner som redan finns
 * skrivs över med den publicerande versionen — det är så en admin rättar ett
 * namn eller en inställning för alla.
 */
export async function publishMachines(machines: Machine[]): Promise<number> {
  const client = supabase();
  if (!client) throw new Error("Inte inloggad.");

  const rows = machines.map((m) => ({
    id: m.qrKey,
    qr_key: m.qrKey,
    qr_raw: m.qrRaw || null,
    name: m.name,
    muscle_group: m.muscleGroup,
    type: m.type,
    metrics: m.metrics,
    plate_options: m.plateOptions,
    weight_step: m.weightStep,
    target_sets: m.targetSets ?? 3,
    note: m.note ?? null,
    updated_at: Date.now(),
  }));

  const { error } = await client
    .from("shared_machines")
    .upsert(rows, { onConflict: "qr_key" });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function removeFromCatalog(qrKey: string): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client
    .from("shared_machines")
    .delete()
    .eq("qr_key", qrKey);
  if (error) throw new Error(error.message);
}

/** Publik adress till en maskinbild. */
export function machineImageUrl(path: string | null | undefined): string | null {
  const client = supabase();
  if (!client || !path) return null;
  return client.storage.from("machine-images").getPublicUrl(path).data.publicUrl;
}

/**
 * Laddar upp en maskinbild.
 *
 * Krymps till 800 pixlar innan den lämnar telefonen. En kamerabild är flera
 * megabyte och visas i en ruta på ett par hundra pixlar — utan nedskalningen
 * skulle katalogen bli tung att ladda på mobildata.
 */
export async function uploadMachineImage(
  qrKey: string,
  blob: Blob,
): Promise<string> {
  const client = supabase();
  if (!client) throw new Error("Inte inloggad.");

  const safe = qrKey.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${safe}.jpg`;
  const { error } = await client.storage
    .from("machine-images")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(error.message);

  const { error: linkError } = await client
    .from("shared_machines")
    .update({ image_path: path, updated_at: Date.now() })
    .eq("qr_key", qrKey);
  if (linkError) throw new Error(linkError.message);

  return path;
}
