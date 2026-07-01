import { KEY, DARK_KEY, TAB_KEY, DEFAULT_SOURCES, MONTHS, OTHER_SOURCE } from "./constants";
import type { State, PersistedData, Tab } from "./types";
import { cloudSave } from "./cloud";
import { render } from "./render";

const readTab = (): Tab => {
  const tab = localStorage.getItem(TAB_KEY);
  return tab === "insights" || tab === "profile" ? tab : "home";
};

export const state: State = {
  dark: localStorage.getItem(DARK_KEY) === "true",
  tab: readTab(),
  year: new Date().getFullYear(),
  chartType: "Bar",
  wins: [],
  goals: {},
  sources: [...DEFAULT_SOURCES],
  showAddForm: false,
  showGoalForm: false,
  showCSVPanel: false,
  showSourceManager: false,
  csvMode: "export",
  csvText: "",
  activeMonth: null,
  winMonth: null,
  editingId: null,
  sourceView: "yearly",
  sourceMonth: MONTHS[new Date().getMonth()],
  confirm: null,
  toast: null,
  editingGoalKey: null,
  addForm: { month: MONTHS[new Date().getMonth()], project: "", amount: "", source: "Bounties" },
  editForm: { month: "Jan", project: "", amount: "", source: "Bounties" },
  goalForm: { month: "Jan", target: "" },
  newSource: "",
  user: null,
  showAuth: false,
  showAccount: false,
  authMode: "signin",
  authBusy: false,
  authError: "",
  authForm: { email: "", password: "" },
  profile: { username: "", avatar: "" },
  showProfileSetup: false,
  editingProfile: false,
  profileForm: { username: "", avatar: "" },
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Load persisted data from localStorage into state. */
export function load(): void {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null") as PersistedData | null;
    if (d) {
      if (d.wins && d.wins.length) state.wins = d.wins;
      if (d.goals) state.goals = d.goals;
      if (d.sources && d.sources.length) state.sources = d.sources.includes(OTHER_SOURCE) ? d.sources : [...d.sources, OTHER_SOURCE];
      if (d.profile) state.profile = { username: d.profile.username || "", avatar: d.profile.avatar || "" };
    }
  } catch {
    /* ignore malformed data */
  }
}

/** Persist to localStorage and (when signed in) queue a cloud sync. */
export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wins: state.wins, goals: state.goals, sources: state.sources, profile: state.profile }));
    localStorage.setItem(DARK_KEY, state.dark ? "true" : "false");
    localStorage.setItem(TAB_KEY, state.tab);
  } catch {
    /* ignore quota / private-mode errors */
  }
  cloudSave();
}

/** Switch tab and remember it across refreshes. */
export function setTab(tab: Tab): void {
  state.tab = tab;
  state.showCSVPanel = false;
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/** Show a transient toast message. */
export function showToast(msg: string): void {
  state.toast = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    render();
  }, 3000);
}

/** Goal key for a given month/year. */
export const gk = (m: string, y: number): string => y + "-" + m;

/** Wins for the currently selected year. */
export const yw = () => state.wins.filter((w) => w.year === state.year);

/** Add a new custom source (from the source manager input). */
export function doAddSource(): void {
  const s = state.newSource.trim();
  const duplicate = state.sources.some((source) => source.toLowerCase() === s.toLowerCase());
  if (!s || duplicate) {
    showToast(s ? "Source already exists" : "Enter a name");
    return;
  }
  state.sources.push(s);
  state.newSource = "";
  save();
  render();
  showToast('Added "' + s + '"');
}
