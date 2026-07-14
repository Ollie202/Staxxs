import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabaseClient";
import { state, showToast, normalizePersistedData, normalizeSources } from "./state";
import { render } from "./render";
import { clearCloudSave, cloudLoad, cloudSave } from "./cloud";
import { KEY, DEFAULT_SOURCES } from "./constants";
import type { PersistedData } from "./types";

let cloudLoaded = false;

function currentData(): PersistedData {
  return { wins: state.wins, goals: state.goals, sources: state.sources, profile: state.profile, updatedAt: state.dataUpdatedAt, ownerEmail: state.dataOwnerEmail };
}

function sessionEmail(session: Session): string {
  return (session.user.email || "").trim().toLowerCase();
}

function newerThan(left?: string, right?: string): boolean {
  if (!left || !right) return !!left && !right;
  return new Date(left).getTime() > new Date(right).getTime();
}

function applyData(data: PersistedData, ownerEmail = ""): void {
  const normalized = normalizePersistedData(data);
  state.wins = normalized.wins;
  state.goals = normalized.goals;
  state.sources = normalized.sources && normalized.sources.length ? normalized.sources : normalizeSources(DEFAULT_SOURCES);
  state.profile = { username: normalized.profile?.username || "", avatar: normalized.profile?.avatar || "" };
  state.profileForm = { ...state.profile };
  state.dataUpdatedAt = normalized.updatedAt || new Date().toISOString();
  state.dataOwnerEmail = (ownerEmail || normalized.ownerEmail || "").trim().toLowerCase();
  try {
    localStorage.setItem(KEY, JSON.stringify({ wins: state.wins, goals: state.goals, sources: state.sources, profile: state.profile, updatedAt: state.dataUpdatedAt, ownerEmail: state.dataOwnerEmail }));
  } catch {
    /* ignore */
  }
}

function fallbackUsername(session: Session): string {
  const meta = session.user.user_metadata || {};
  return String(meta.user_name || meta.name || meta.full_name || session.user.email?.split("@")[0] || "");
}

export async function signInGoogle(): Promise<void> {
  if (!sb) { state.authError = "Cloud sync isn't configured yet."; render(); return; }
  state.authBusy = true; state.authError = ""; render();
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) {
    state.authBusy = false;
    state.authError = error.message;
    render();
  }
}

export async function signOut(): Promise<void> {
  clearCloudSave();
  if (sb) await sb.auth.signOut();
  state.user = null;
  state.showAccount = false;
  cloudLoaded = false;
  render();
  showToast("Signed out");
}

async function onSignedIn(session: Session, event: string): Promise<void> {
  state.user = session.user;
  if (!cloudLoaded && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
    cloudLoaded = true;
    const local = currentData();
    const email = sessionEmail(session);
    const cloud = await cloudLoad();
    if (cloud === undefined) {
      state.showAuth = false;
      render();
      showToast("Cloud sync unavailable. Keeping local data for now.");
      return;
    }
    const isNewCloudUser = cloud === null;
    if (cloud) {
      const localBelongsToThisAccount = !!email && local.ownerEmail === email;
      if (localBelongsToThisAccount && newerThan(local.updatedAt, cloud.updatedAt)) {
        applyData(local, email);
        cloudSave();
      } else {
        applyData(cloud, email);
      }
    } else {
      applyData(local, email);
      cloudSave();
    }
    if (isNewCloudUser || !state.profile.username) {
      state.profileForm = { username: state.profile.username || fallbackUsername(session), avatar: state.profile.avatar };
      state.showProfileSetup = true;
      state.editingProfile = false;
    }
  }
  state.showAuth = false;
  render();
}

/** Subscribe to auth changes to restore sessions and react to sign-in/out. */
export function initAuth(): void {
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      onSignedIn(session, event);
    } else {
      state.user = null;
      cloudLoaded = false;
      render();
    }
  });
}
