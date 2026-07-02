import { KEY, DARK_KEY, TAB_KEY, OLD_KEY, OLD_DARK_KEY, OLD_TAB_KEY, DEFAULT_SOURCES, MONTHS, OTHER_SOURCE, YEARLY_GOAL_LABEL, normalizeMonth } from "./constants";
import type { State, PersistedData, Tab, Goals, Win } from "./types";
import { cloudSave } from "./cloud";
import { render } from "./render";

const readTab = (): Tab => {
  const tab = localStorage.getItem(TAB_KEY) || localStorage.getItem(OLD_TAB_KEY);
  return tab === "insights" || tab === "profile" ? tab : "home";
};

export const state: State = {
  dark: (localStorage.getItem(DARK_KEY) || localStorage.getItem(OLD_DARK_KEY)) === "true",
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
  monthReport: null,
  yearReport: false,
  chartBreakdownMonth: null,
  showSharePicker: false,
  winMonth: null,
  editingId: null,
  sourceView: "yearly",
  sourceMonth: MONTHS[new Date().getMonth()],
  summaryScope: "monthly",
  summaryMonth: MONTHS[new Date().getMonth()],
  resetYear: String(new Date().getFullYear()),
  resetMonth: MONTHS[new Date().getMonth()],
  confirm: null,
  toast: null,
  editingGoalKey: null,
  addForm: { month: MONTHS[new Date().getMonth()], project: "", amount: "", source: "Bounties" },
  editForm: { month: MONTHS[0], project: "", amount: "", source: "Bounties" },
  goalForm: { month: MONTHS[0], target: "" },
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

function normalizeWins(wins: Win[]): Win[] {
  return wins.map((win) => ({ ...win, month: normalizeMonth(win.month) || win.month }));
}

function normalizeGoals(goals: Goals): Goals {
  const out: Goals = {};
  Object.entries(goals).forEach(([key, target]) => {
    const splitAt = key.indexOf("-");
    if (splitAt === -1) return;
    const year = key.slice(0, splitAt);
    const yearNumber = Number(year);
    const rawPeriod = key.slice(splitAt + 1).trim();
    const month = normalizeMonth(rawPeriod);
    if (!Number.isNaN(yearNumber) && month) out[gk(month, yearNumber)] = target;
    if (!Number.isNaN(yearNumber) && rawPeriod.toLowerCase() === YEARLY_GOAL_LABEL.toLowerCase()) out[ygk(yearNumber)] = target;
  });
  return out;
}

export function normalizePersistedData(data: PersistedData): PersistedData {
  return {
    wins: normalizeWins(data.wins || []),
    goals: normalizeGoals(data.goals || {}),
    sources: data.sources || [],
    profile: data.profile,
  };
}

/** Load persisted data from localStorage into state. */
export function load(): void {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || "null") as PersistedData | null;
    if (d) {
      const normalized = normalizePersistedData(d);
      if (normalized.wins.length) state.wins = normalized.wins;
      if (normalized.goals) state.goals = normalized.goals;
      if (normalized.sources.length) state.sources = normalized.sources.includes(OTHER_SOURCE) ? normalized.sources : [...normalized.sources, OTHER_SOURCE];
      if (normalized.profile) state.profile = { username: normalized.profile.username || "", avatar: normalized.profile.avatar || "" };
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

/** Goal key for a full year. */
export const ygk = (y: number): string => y + "-" + YEARLY_GOAL_LABEL;

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
