import { KEY, DARK_KEY, DEFAULT_SOURCES, MONTHS } from "./constants";
import type { State, PersistedData } from "./types";
import { cloudSave } from "./cloud";
import { render } from "./render";

export const state: State = {
  dark: localStorage.getItem(DARK_KEY) === "true",
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
  confirmReset: null,
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
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Load persisted data from localStorage into state. */
export function load(): void {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null") as PersistedData | null;
    if (d) {
      if (d.wins && d.wins.length) state.wins = d.wins;
      if (d.goals) state.goals = d.goals;
      if (d.sources && d.sources.length) state.sources = d.sources;
    }
  } catch {
    /* ignore malformed data */
  }
}

/** Persist to localStorage and (when signed in) queue a cloud sync. */
export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wins: state.wins, goals: state.goals, sources: state.sources }));
    localStorage.setItem(DARK_KEY, state.dark ? "true" : "false");
  } catch {
    /* ignore quota / private-mode errors */
  }
  cloudSave();
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
  if (!s || state.sources.includes(s)) {
    showToast(s ? "Source already exists" : "Enter a name");
    return;
  }
  state.sources.push(s);
  state.newSource = "";
  save();
  render();
  showToast('Added "' + s + '"');
}
