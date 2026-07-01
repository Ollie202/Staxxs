import type { User } from "@supabase/supabase-js";

export interface Win {
  id: string;
  year: number;
  month: string;
  project: string;
  amount: number;
  source: string;
}

/** Goals keyed by `${year}-${month}` → target amount. */
export type Goals = Record<string, number>;

export interface AddForm {
  month: string;
  project: string;
  amount: string;
  source: string;
}

export interface GoalForm {
  month: string;
  target: string;
}

export interface AuthForm {
  email: string;
  password: string;
}

export type CsvMode = "export" | "import";
export type SourceView = "yearly" | "monthly";
export type AuthMode = "signin" | "signup";
export type ResetType = "month" | "year" | null;

export interface State {
  dark: boolean;
  year: number;
  chartType: string;
  wins: Win[];
  goals: Goals;
  sources: string[];
  showAddForm: boolean;
  showGoalForm: boolean;
  showCSVPanel: boolean;
  showSourceManager: boolean;
  csvMode: CsvMode;
  csvText: string;
  activeMonth: string | null;
  winMonth: string | null;
  editingId: string | null;
  sourceView: SourceView;
  sourceMonth: string;
  confirmReset: ResetType;
  toast: string | null;
  editingGoalKey: string | null;
  addForm: AddForm;
  editForm: AddForm;
  goalForm: GoalForm;
  newSource: string;
  user: User | null;
  showAuth: boolean;
  showAccount: boolean;
  authMode: AuthMode;
  authBusy: boolean;
  authError: string;
  authForm: AuthForm;
}

/** Persisted slice of state saved to localStorage / the cloud. */
export interface PersistedData {
  wins: Win[];
  goals: Goals;
  sources: string[];
}
