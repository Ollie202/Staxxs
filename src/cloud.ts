import { sb } from "./supabaseClient";
import { state } from "./state";
import type { PersistedData } from "./types";

let cloudTimer: ReturnType<typeof setTimeout> | undefined;

const accountEmail = (): string => (state.user?.email || "").trim().toLowerCase();

/** Load this user's data blob from Supabase. Null means no row; undefined means load failed. */
export async function cloudLoad(): Promise<PersistedData | null | undefined> {
  if (!sb || !state.user) return null;
  const email = accountEmail();
  const { data, error } = await sb
    .from("user_data")
    .select("data")
    .eq(email ? "account_email" : "user_id", email || state.user.id)
    .maybeSingle();
  if (error) {
    console.warn("cloud load failed", error);
    return undefined;
  }
  return data ? (data.data as PersistedData) : null;
}

/** Debounced upsert of the current data to Supabase (no-op when signed out). */
export function cloudSave(): void {
  if (!sb || !state.user) return;
  const client = sb;
  const userId = state.user.id;
  const email = accountEmail();
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    const payload = {
      user_id: userId,
      account_email: email,
      data: { wins: state.wins, goals: state.goals, sources: state.sources, profile: state.profile },
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("user_data").upsert(payload, { onConflict: "account_email" });
    if (error) console.warn("cloud save failed", error);
  }, 800);
}
