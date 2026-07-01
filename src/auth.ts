import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabaseClient";
import { state, showToast } from "./state";
import { render } from "./render";
import { cloudLoad, cloudSave } from "./cloud";
import { KEY, DEFAULT_SOURCES } from "./constants";

let cloudLoaded = false;

export async function signInGoogle(): Promise<void> {
  if (!sb) { state.authError = "Cloud sync isn't configured yet."; render(); return; }
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export async function signInEmail(): Promise<void> {
  if (!sb) { state.authError = "Cloud sync isn't configured yet."; render(); return; }
  const { email, password } = state.authForm;
  if (!email || !password) { state.authError = "Enter your email and password."; render(); return; }
  state.authBusy = true; state.authError = ""; render();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
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
    const cloud = await cloudLoad();
    if (cloud) {
      state.wins = cloud.wins || [];
      state.goals = cloud.goals || {};
      state.sources = cloud.sources && cloud.sources.length ? cloud.sources : [...DEFAULT_SOURCES];
      try {
        localStorage.setItem(KEY, JSON.stringify({ wins: state.wins, goals: state.goals, sources: state.sources }));
      } catch {
        /* ignore */
      }
    } else {
      // First sign-in with no cloud data yet — migrate whatever is local up to the cloud.
      cloudSave();
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
