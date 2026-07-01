import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabaseClient";
import { state, showToast } from "./state";
import { render } from "./render";
import { clearCloudSave, cloudLoad, cloudSave } from "./cloud";
import { KEY, DEFAULT_SOURCES } from "./constants";
import type { PersistedData } from "./types";

let cloudLoaded = false;

function currentData(): PersistedData {
  return { wins: state.wins, goals: state.goals, sources: state.sources, profile: state.profile };
}

function applyData(data: PersistedData): void {
  state.wins = data.wins || [];
  state.goals = data.goals || {};
  state.sources = data.sources && data.sources.length ? data.sources : [...DEFAULT_SOURCES];
  state.profile = { username: data.profile?.username || "", avatar: data.profile?.avatar || "" };
  state.profileForm = { ...state.profile };
  try {
    localStorage.setItem(KEY, JSON.stringify({ wins: state.wins, goals: state.goals, sources: state.sources, profile: state.profile }));
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

export async function signInEmail(): Promise<void> {
  if (!sb) { state.authError = "Cloud sync isn't configured yet."; render(); return; }
  const { email, password } = state.authForm;
  if (!email || !password) { state.authError = "Enter your email and password."; render(); return; }
  state.authBusy = true; state.authError = ""; render();
  const cleanEmail = email.trim();
  const { error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
  state.authBusy = false;
  if (error) { state.authError = error.message; render(); return; }
}

export async function signUpEmail(): Promise<void> {
  if (!sb) { state.authError = "Cloud sync isn't configured yet."; render(); return; }
  const { email, password } = state.authForm;
  if (!email || !password) { state.authError = "Enter your email and password."; render(); return; }
  if (password.length < 6) { state.authError = "Password must be at least 6 characters."; render(); return; }
  state.authBusy = true; state.authError = ""; render();
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  state.authBusy = false;
  if (error) { state.authError = error.message; render(); return; }
  if (data.user && !data.session) {
    state.showAuth = false; render();
    showToast("Check your email to confirm your account");
    return;
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
    const cloud = await cloudLoad();
    if (cloud === undefined) {
      state.showAuth = false;
      render();
      showToast("Cloud sync unavailable. Keeping local data for now.");
      return;
    }
    const isNewCloudUser = cloud === null;
    if (cloud) {
      applyData(cloud);
    } else {
      applyData(local);
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
