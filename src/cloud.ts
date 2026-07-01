import { sb } from "./supabaseClient";
import { state } from "./state";
import type { PersistedData } from "./types";

let cloudTimer: ReturnType<typeof setTimeout> | undefined;

const accountEmail = (): string => (state.user?.email || "").trim().toLowerCase();
const currentData = (): PersistedData => ({
  wins: state.wins.map((win) => ({ ...win })),
  goals: { ...state.goals },
  sources: [...state.sources],
  profile: { ...state.profile },
});
const hasEmailColumnError = (error: { code?: string; message?: string }): boolean =>
  error.code === "42703" ||
  error.code === "42P10" ||
  error.code === "PGRST204" ||
  /account_email|unique or exclusion constraint/i.test(error.message || "");

async function loadByUserId(): Promise<PersistedData | null | undefined> {
  if (!sb || !state.user) return null;
  const { data, error } = await sb
    .from("user_data")
    .select("data")
    .eq("user_id", state.user.id)
    .maybeSingle();
  if (error) {
    console.warn("cloud load failed", error);
    return undefined;
  }
  return data ? (data.data as PersistedData) : null;
}

/** Load this user's data blob from Supabase. Null means no row; undefined means load failed. */
export async function cloudLoad(): Promise<PersistedData | null | undefined> {
  if (!sb || !state.user) return null;
  const email = accountEmail();
  if (!email) return loadByUserId();
  const { data, error } = await sb
    .from("user_data")
    .select("data")
    .eq("account_email", email)
    .maybeSingle();
  if (error) {
    if (hasEmailColumnError(error)) return loadByUserId();
    console.warn("cloud load failed", error);
    return undefined;
  }
  if (data) return data.data as PersistedData;
  return loadByUserId();
}

/** Debounced upsert of the current data to Supabase (no-op when signed out). */
export function cloudSave(): void {
  if (!sb || !state.user) return;
  const client = sb;
  const userId = state.user.id;
  const email = accountEmail();
  const data = currentData();
  const updatedAt = new Date().toISOString();
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    if (!email) {
      const { error } = await client.from("user_data").upsert({ user_id: userId, data, updated_at: updatedAt }, { onConflict: "user_id" });
      if (error) console.warn("cloud save failed", error);
      return;
    }
    const payload = {
      user_id: userId,
      account_email: email,
      data,
      updated_at: updatedAt,
    };
    const { error } = await client.from("user_data").upsert(payload, { onConflict: "account_email" });
    if (error && hasEmailColumnError(error)) {
      const fallbackPayload = {
        user_id: userId,
        data: payload.data,
        updated_at: payload.updated_at,
      };
      const { error: fallbackError } = await client.from("user_data").upsert(fallbackPayload, { onConflict: "user_id" });
      if (fallbackError) console.warn("cloud save failed", fallbackError);
      return;
    }
    if (error) console.warn("cloud save failed", error);
  }, 800);
}

export function clearCloudSave(): void {
  clearTimeout(cloudTimer);
  cloudTimer = undefined;
}
