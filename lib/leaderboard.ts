"use client";

import { newId } from "./db";
import { supabase } from "./supabase";
import type { MuscleGroup } from "./types";

export interface Lift {
  id: string;
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  category: string;
  exercise: string;
  weight: number;
  reps: number | null;
  verified: boolean;
  updated_at: number;
}

/** Kategorierna på topplistan följer appens muskelgrupper. */
export const LIFT_CATEGORIES: MuscleGroup[] = [
  "Bröst",
  "Rygg",
  "Axlar",
  "Biceps",
  "Triceps",
  "Ben",
  "Vader",
  "Mage",
  "Helkropp",
];

export async function fetchLifts(): Promise<Lift[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from("leaderboard_lifts")
    .select("*")
    .order("weight", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Lift[];
}

export async function currentUserId(): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Sant om den inloggade står i admins-tabellen. Styr bara vad som visas. */
export async function isAdmin(): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await client
    .from("admins")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();
  return Boolean(data);
}

export async function saveLift(input: {
  id?: string;
  displayName: string;
  avatarPath?: string | null;
  category: string;
  exercise: string;
  weight: number;
  reps?: number | null;
}): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Inte inloggad.");
  const uid = await currentUserId();
  if (!uid) throw new Error("Inte inloggad.");

  const { error } = await client.from("leaderboard_lifts").upsert({
    id: input.id ?? newId(),
    user_id: uid,
    display_name: input.displayName,
    avatar_path: input.avatarPath ?? null,
    category: input.category,
    exercise: input.exercise,
    weight: input.weight,
    reps: input.reps ?? null,
    updated_at: Date.now(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteLift(id: string): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client.from("leaderboard_lifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Administratörsåtgärder.
 *
 * Att de här anropen finns i appen betyder inte att vem som helst kan använda
 * dem. Databasen avvisar dem för alla som inte står i admins-tabellen, och
 * bocken nollställs av en utlösare — lösenordet i gränssnittet är bekvämlighet,
 * inte skydd.
 */
export async function setVerified(id: string, verified: boolean): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client
    .from("leaderboard_lifts")
    .update({ verified, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function renameLifter(id: string, displayName: string): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client
    .from("leaderboard_lifts")
    .update({ display_name: displayName, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Publik adress till en uppladdad profilbild. */
export function avatarUrl(path: string | null | undefined): string | null {
  const client = supabase();
  if (!client || !path) return null;
  return client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/** Laddar upp en krympt profilbild och returnerar sökvägen. */
export async function uploadAvatar(blob: Blob): Promise<string> {
  const client = supabase();
  if (!client) throw new Error("Inte inloggad.");
  const uid = await currentUserId();
  if (!uid) throw new Error("Inte inloggad.");

  // Mappen måste heta användarens id — reglerna i schemat kräver det, så att
  // ingen kan skriva över någon annans bild.
  const path = `${uid}/avatar.jpg`;
  const { error } = await client.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}
