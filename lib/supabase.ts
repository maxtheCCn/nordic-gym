"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Synk är valfritt.
 *
 * Saknas nycklarna körs appen precis som förut, helt lokalt — inga fel, inga
 * halvtrasiga inloggningsknappar. Det gör också att appen går att klona och
 * köra utan att först sätta upp en server.
 */
export const syncConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Inloggningen sker med lösenord i appen, inte via länkar i adressfältet.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Användarnamn görs om till en mejladress eftersom Supabase kräver det
 * formatet. Domänen är påhittad och tar aldrig emot post — det är själva
 * poängen, du ska kunna skapa konto utan att bekräfta något.
 */
export function usernameToEmail(username: string): string {
  const clean = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return `${clean}@nwlogg.local`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(username.trim());
}
