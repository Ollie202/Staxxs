import { KEY, OLD_KEY, DARK_KEY, OLD_DARK_KEY, TAB_KEY, OLD_TAB_KEY } from "./constants";

const OLD_HOSTS = new Set(["wins-tracker-app.vercel.app", "staxx-tracker.vercel.app"]);
const TRANSFER_PREFIX = "staxxs-local-migration:";

interface MigrationTransfer {
  from: string;
  createdAt: string;
  items: Record<string, string>;
}

function localStorageSnapshot(): Record<string, string> {
  const items: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key);
      if (value !== null) items[key] = value;
    }
  } catch {
    /* ignore storage access errors */
  }
  return items;
}

function pickDataKey(items: Record<string, string>): string | null {
  const preferred = [KEY, OLD_KEY, "wins-tracker-v1", "wins-tracker", "earnings-tracker-v1", "earnings-tracker"];
  return preferred.find((key) => !!items[key]) || null;
}

function mergeData(existingRaw: string | null, incomingRaw: string): string {
  if (!existingRaw) return incomingRaw;
  try {
    const existing = JSON.parse(existingRaw) as Record<string, unknown>;
    const incoming = JSON.parse(incomingRaw) as Record<string, unknown>;
    const existingWins = Array.isArray(existing.wins) ? existing.wins : [];
    const incomingWins = Array.isArray(incoming.wins) ? incoming.wins : [];
    const seen = new Set<string>();
    const wins = [...incomingWins, ...existingWins].filter((win) => {
      const item = win as { id?: string; year?: number; month?: string; project?: string; amount?: number; source?: string };
      const key = item.id || [item.year, item.month, item.project, item.amount, item.source].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return JSON.stringify({
      ...existing,
      ...incoming,
      wins,
      goals: { ...((existing.goals as object) || {}), ...((incoming.goals as object) || {}) },
      sources: Array.from(new Set([...(Array.isArray(existing.sources) ? existing.sources : []), ...(Array.isArray(incoming.sources) ? incoming.sources : [])])),
      profile: (incoming.profile as object) || (existing.profile as object),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return incomingRaw;
  }
}

function importTransfer(raw: string): boolean {
  if (!raw.startsWith(TRANSFER_PREFIX)) return false;
  try {
    const transfer = JSON.parse(raw.slice(TRANSFER_PREFIX.length)) as MigrationTransfer;
    const dataKey = pickDataKey(transfer.items || {});
    if (!dataKey) return false;

    localStorage.setItem(KEY, mergeData(localStorage.getItem(KEY), transfer.items[dataKey]));
    if (transfer.items[DARK_KEY] || transfer.items[OLD_DARK_KEY]) {
      localStorage.setItem(DARK_KEY, transfer.items[DARK_KEY] || transfer.items[OLD_DARK_KEY]);
    }
    if (transfer.items[TAB_KEY] || transfer.items[OLD_TAB_KEY]) {
      localStorage.setItem(TAB_KEY, transfer.items[TAB_KEY] || transfer.items[OLD_TAB_KEY]);
    }
    window.name = "";
    history.replaceState(null, "", window.location.pathname + window.location.search);
    sessionStorage.setItem("staxxs-migration-done", transfer.from);
    return true;
  } catch {
    return false;
  }
}

export function migrateOldDomainData(): "imported" | "redirecting" | "idle" {
  const host = window.location.hostname.toLowerCase();
  if (OLD_HOSTS.has(host)) {
    const transfer: MigrationTransfer = {
      from: host,
      createdAt: new Date().toISOString(),
      items: localStorageSnapshot(),
    };
    window.name = TRANSFER_PREFIX + JSON.stringify(transfer);
    window.location.replace("https://staxxs-tracker.vercel.app/");
    return "redirecting";
  }

  if (!OLD_HOSTS.has(host) && importTransfer(window.name || "")) return "imported";
  return "idle";
}

export function consumeMigrationNotice(): string | null {
  try {
    const from = sessionStorage.getItem("staxxs-migration-done");
    if (!from) return null;
    sessionStorage.removeItem("staxxs-migration-done");
    return from;
  } catch {
    return null;
  }
}
