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

export interface UserProfile {
  username: string;
  avatar: string;
}

export type CsvMode = "export" | "import";
export type SourceView = "yearly" | "monthly";
export type AuthMode = "signin" | "signup";
export type Tab = "home" | "insights" | "profile";
export type ResetType = "month" | "year" | null;

/** Generic confirmation dialog for any destructive action. */
export interface ConfirmDialog {
  title: string;
  detail?: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export interface State {
  dark: boolean;
  tab: Tab;
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
  confirm: ConfirmDialog | null;
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
  profile: UserProfile;
  showProfileSetup: boolean;
  editingProfile: boolean;
  profileForm: UserProfile;
}

/** Persisted slice of state saved to localStorage / the cloud. */
export interface PersistedData {
  wins: Win[];
  goals: Goals;
  sources: string[];
  profile?: UserProfile;
}
