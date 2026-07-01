import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** True once real Supabase credentials are configured (env vars filled in). */
export const cloudEnabled = (): boolean =>
  !!SUPABASE_URL &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON");

/** Shared Supabase client, or null when cloud sync isn't configured. */
export const sb: SupabaseClient | null = cloudEnabled()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
