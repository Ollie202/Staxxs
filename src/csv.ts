import { state, showToast, save } from "./state";
import { MONTHS } from "./constants";
import { gid, escRe } from "./dom";
import { render } from "./render";
import type { Goals, Win } from "./types";

export function exportCSV(): void {
  if (state.wins.length === 0 && Object.keys(state.goals).length === 0) {
    showToast("Nothing to export yet");
    return;
  }
  const rows = ["Year,Month,Project,Amount,Source"];
  [...state.wins]
    .sort((a, b) => a.year - b.year || MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
    .forEach((w) => {
      const proj = w.project.includes(",") ? '"' + w.project + '"' : w.project;
      rows.push(w.year + "," + w.month + "," + proj + "," + w.amount + "," + w.source);
    });
  const ge = Object.entries(state.goals).sort();
  if (ge.length > 0) {
    rows.push("");
    rows.push("GOAL,Year,Month,Target");
    ge.forEach(([k, t]) => {
      const [yr, mo] = k.split("-");
      rows.push("GOAL," + yr + "," + mo + "," + t);
    });
  }
  state.csvText = rows.join("\n");
  state.csvMode = "export";
  state.showCSVPanel = true;
  try {
    navigator.clipboard.writeText(state.csvText);
    showToast("CSV copied to clipboard");
  } catch {
    showToast("CSV ready — copy from the box");
  }
  render();
}

export function downloadCSV(): void {
  if (!state.csvText) exportCSV();
  if (!state.csvText) return;
  const blob = new Blob([state.csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Staxx-" + state.year + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV file downloaded");
}

export function importCSV(): void {
  if (!state.csvText.trim()) {
    showToast("Paste your CSV data first");
    return;
  }
  // Normalize: detect delimiter (tab, semicolon, or comma)
  const raw = state.csvText.trim();
  const firstLine = raw.split("\n")[0];
  const delim = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
  const lines = raw.split("\n");
  const nw: Win[] = [];
  const ns: string[] = [];
  const ng: Goals = {};
  let sk = 0, gc = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    // Skip header rows
    if (lower.startsWith("year" + delim + "month") || lower.startsWith("year,month") || lower.startsWith("year;month") || lower.startsWith("year\tmonth")) continue;
    if (lower.startsWith("goal" + delim + "year") || lower.startsWith("goal,year") || lower.startsWith("goal;year") || lower.startsWith("goal\tyear")) continue;
    // Parse GOAL rows (case-insensitive)
    if (lower.startsWith("goal" + delim) || lower.startsWith("goal,") || lower.startsWith("goal;") || lower.startsWith("goal\t")) {
      const p = line.split(delim.length ? delim : ",");
      if (p.length >= 4) {
        const yr = parseInt(p[1]), mo = p[2].trim(), t = parseFloat(p[3]);
        if (!isNaN(yr) && !isNaN(t) && MONTHS.includes(mo)) { ng[yr + "-" + mo] = t; gc++; continue; }
      }
      sk++;
      continue;
    }
    // Parse win rows — handle quoted fields
    let parts: string[];
    if (line.includes('"')) {
      const sep = delim === "," ? "," : delim;
      const re = new RegExp("^(\\d+)" + escRe(sep) + "(\\w+)" + escRe(sep) + '"([^"]+)"' + escRe(sep) + "([^" + escRe(sep) + "]+)(?:" + escRe(sep) + "(.+))?$");
      const m = line.match(re);
      if (m) parts = [m[1], m[2], m[3], m[4], m[5] || ""];
      else { sk++; continue; }
    } else {
      parts = line.split(delim);
    }
    if (parts.length < 4) { sk++; continue; }
    const yr = parseInt(parts[0]), mo = parts[1].trim(), proj = parts[2].trim(), amt = parseFloat(parts[3]);
    const src = parts.length >= 5 && parts[4].trim() ? parts[4].trim() : "Other";
    if (isNaN(yr) || isNaN(amt) || !proj || !MONTHS.includes(mo)) { sk++; continue; }
    if (src && !state.sources.includes(src) && !ns.includes(src)) ns.push(src);
    nw.push({ id: gid(), year: yr, month: mo, project: proj, amount: amt, source: src });
  }
  if (nw.length === 0 && gc === 0) {
    showToast("No valid rows found — check format");
    return;
  }
  if (ns.length > 0) state.sources.push(...ns);
  if (nw.length > 0) state.wins.push(...nw);
  if (gc > 0) Object.assign(state.goals, ng);
  const mp: string[] = [];
  if (nw.length) mp.push(nw.length + " wins");
  if (gc) mp.push(gc + " goals");
  if (ns.length) mp.push(ns.length + " new sources");
  showToast("Imported " + mp.join(" + ") + (sk > 0 ? " (" + sk + " skipped)" : ""));
  state.csvText = "";
  state.showCSVPanel = false;
  save();
  render();
}
