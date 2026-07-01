import { sb } from "./supabaseClient";
import { state } from "./state";
import type { PersistedData } from "./types";

let cloudTimer: ReturnType<typeof setTimeout> | undefined;

/** Load this user's data blob from Supabase, or null if none/unavailable. */
export async function cloudLoad(): Promise<PersistedData | null> {
  if (!sb || !state.user) return null;
  const { data, error } = await sb
    .from("user_data")
    .select("data")
    .eq("user_id", state.user.id)
    .maybeSingle();
  if (error) {
    console.warn("cloud load failed", error);
    return null;
  }
  return data ? (data.data as PersistedData) : null;
}

/** Debounced upsert of the current data to Supabase (no-op when signed out). */
export function cloudSave(): void {
  if (!sb || !state.user) return;
  const client = sb;
  const userId = state.user.id;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    const payload = {
      user_id: userId,
      data: { wins: state.wins, goals: state.goals, sources: state.sources },
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("user_data").upsert(payload, { onConflict: "user_id" });
    if (error) console.warn("cloud save failed", error);
  }, 800);
}
