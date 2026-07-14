import { sb } from "./supabaseClient";
import { state } from "./state";
import type { PersistedData } from "./types";

let cloudTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: PendingCloudSave | null = null;
let saveInFlight = false;

interface PendingCloudSave {
  userId: string;
  email: string;
  data: PersistedData;
  updatedAt: string;
}

const accountEmail = (): string => (state.user?.email || "").trim().toLowerCase();
const currentData = (): PersistedData => ({
  wins: state.wins.map((win) => ({ ...win })),
  goals: { ...state.goals },
  sources: [...state.sources],
  profile: { ...state.profile },
  updatedAt: state.dataUpdatedAt || new Date().toISOString(),
  ownerEmail: accountEmail() || state.dataOwnerEmail,
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
    .select("data, updated_at")
    .eq("user_id", state.user.id)
    .maybeSingle();
  if (error) {
    console.warn("cloud load failed", error);
    return undefined;
  }
  return data ? ({ ...(data.data as PersistedData), updatedAt: data.updated_at, ownerEmail: "" }) : null;
}

/** Load this user's data blob from Supabase. Null means no row; undefined means load failed. */
export async function cloudLoad(): Promise<PersistedData | null | undefined> {
  if (!sb || !state.user) return null;
  const email = accountEmail();
  if (!email) return loadByUserId();
  const { data, error } = await sb
    .from("user_data")
    .select("data, updated_at, account_email")
    .eq("account_email", email)
    .maybeSingle();
  if (error) {
    if (hasEmailColumnError(error)) return loadByUserId();
    console.warn("cloud load failed", error);
    return undefined;
  }
  if (data) return { ...(data.data as PersistedData), updatedAt: data.updated_at, ownerEmail: data.account_email || email };
  return loadByUserId();
}

async function flushCloudSave(): Promise<void> {
  if (!sb || !pendingSave || saveInFlight) return;
  if (!state.user || state.user.id !== pendingSave.userId) return;
  const client = sb;
  const pending = pendingSave;
  saveInFlight = true;
  let failed = false;
  if (!pending.email) {
    const { error } = await client.from("user_data").upsert({ user_id: pending.userId, data: pending.data, updated_at: pending.updatedAt }, { onConflict: "user_id" });
    failed = !!error;
    if (error) console.warn("cloud save failed", error);
  } else {
    const payload = {
      user_id: pending.userId,
      account_email: pending.email,
      data: pending.data,
      updated_at: pending.updatedAt,
    };
    const { error } = await client.from("user_data").upsert(payload, { onConflict: "account_email" });
    if (error && hasEmailColumnError(error)) {
      const fallbackPayload = {
        user_id: pending.userId,
        data: pending.data,
        updated_at: pending.updatedAt,
      };
      const { error: fallbackError } = await client.from("user_data").upsert(fallbackPayload, { onConflict: "user_id" });
      failed = !!fallbackError;
      if (fallbackError) console.warn("cloud save failed", fallbackError);
    } else {
      failed = !!error;
      if (error) console.warn("cloud save failed", error);
    }
  }
  saveInFlight = false;
  if (!failed && pendingSave === pending) pendingSave = null;
  if (pendingSave && pendingSave !== pending) void flushCloudSave();
}

/** Debounced upsert of the current data to Supabase (no-op when signed out). */
export function cloudSave(): void {
  if (!sb || !state.user) return;
  const userId = state.user.id;
  const email = accountEmail();
  const data = currentData();
  const updatedAt = data.updatedAt || new Date().toISOString();
  pendingSave = { userId, email, data: { ...data, updatedAt, ownerEmail: email || data.ownerEmail }, updatedAt };
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => { void flushCloudSave(); }, 800);
}

export function clearCloudSave(): void {
  clearTimeout(cloudTimer);
  cloudTimer = undefined;
  pendingSave = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushCloudSave(); });
}
