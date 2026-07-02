import { state, save, showToast, gk, ygk, yw, doAddSource, setTab } from "./state";
import { LIGHT, DARK, type Theme } from "./theme";
import type { Tab } from "./types";
import { MONTHS, MONTH_ABBREVIATIONS, CHART_TYPES, OTHER_SOURCE, YEARLY_GOAL_LABEL, monthIndex } from "./constants";
import { el, fmt, gid, $ } from "./dom";
import { mkSelect, mkInput, mkPill, mkDropdown } from "./ui";
import { renderChart } from "./chart";
import { exportCSV, downloadCSV, importCSV } from "./csv";
import { signInGoogle, signInEmail, signUpEmail, signOut } from "./auth";
import { cloudEnabled } from "./supabaseClient";

// Logo lives in public/ so it's copied to the deploy root; BASE_URL keeps the
// path correct on both the Vercel root and the GitHub Pages /Staxxs/ subpath.
const LOGO_URL = import.meta.env.BASE_URL + "favicon-192.png";

function monthReportData(month: string) {
  const wins = yw().filter((w) => w.month === month);
  const total = wins.reduce((sum, win) => sum + win.amount, 0);
  const sourceMap: Record<string, number> = {};
  wins.forEach((win) => { sourceMap[win.source] = (sourceMap[win.source] || 0) + win.amount; });
  const sources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
  const topSource = sources[0]?.[0] || "None yet";
  const biggestWin = [...wins].sort((a, b) => b.amount - a.amount)[0];
  const goal = state.goals[gk(month, state.year)] || 0;
  const goalPct = goal ? Math.round((total / goal) * 100) : 0;
  return { wins, total, sources, topSource, biggestWin, goal, goalPct };
}

function yearReportData() {
  const wins = yw();
  const total = wins.reduce((sum, win) => sum + win.amount, 0);
  const sourceMap: Record<string, number> = {};
  wins.forEach((win) => { sourceMap[win.source] = (sourceMap[win.source] || 0) + win.amount; });
  const sources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
  const topSource = sources[0]?.[0] || "None yet";
  const biggestWin = [...wins].sort((a, b) => b.amount - a.amount)[0];
  const goal = state.goals[ygk(state.year)] || 0;
  const goalPct = goal ? Math.round((total / goal) * 100) : 0;
  return { wins, total, sources, topSource, biggestWin, goal, goalPct };
}

function activeShareReport() {
  const yearly = state.yearReport;
  const month = state.monthReport || MONTHS[new Date().getMonth()];
  const report = yearly ? yearReportData() : monthReportData(month);
  return {
    ...report,
    yearly,
    title: yearly ? String(state.year) : month + " " + state.year,
    fileLabel: yearly ? String(state.year) : month + "-" + state.year,
    eyebrow: yearly ? "YEARLY EARNINGS" : "MONTHLY EARNINGS",
    periodText: yearly ? "this year" : "in " + month,
  };
}

function openMonthReport(month: string): void {
  state.monthReport = month;
  state.yearReport = false;
  state.showSharePicker = false;
  render();
}

function openYearReport(): void {
  state.monthReport = null;
  state.yearReport = true;
  state.showSharePicker = false;
  render();
}

function openChartBreakdown(month: string): void {
  state.chartBreakdownMonth = month;
  render();
}

function closeChartBreakdown(): void {
  state.chartBreakdownMonth = null;
  render();
}

function closeShareReport(): void {
  state.monthReport = null;
  state.yearReport = false;
  render();
}

function resetYearOptions(): string[] {
  const years = new Set<number>([state.year, Number(state.resetYear) || new Date().getFullYear()]);
  state.wins.forEach((win) => years.add(win.year));
  Object.keys(state.goals).forEach((key) => {
    const splitAt = key.indexOf("-");
    if (splitAt === -1) return;
    const year = Number(key.slice(0, splitAt));
    if (!Number.isNaN(year)) years.add(year);
  });
  return [...years].sort((a, b) => b - a).map(String);
}

function resetSummary(year: number, month?: string): { wins: number; goals: number; total: number } {
  const wins = state.wins.filter((win) => win.year === year && (!month || win.month === month));
  const goalKeys = month ? [gk(month, year)] : [...MONTHS.map((m) => gk(m, year)), ygk(year)];
  return {
    wins: wins.length,
    goals: goalKeys.filter((key) => state.goals[key] !== undefined).length,
    total: wins.reduce((sum, win) => sum + win.amount, 0),
  };
}

function confirmResetProgress(scope: "month" | "year"): void {
  const year = Number(state.resetYear);
  if (Number.isNaN(year)) {
    showToast("Choose a valid year");
    return;
  }
  const month = scope === "month" ? state.resetMonth : undefined;
  const summary = resetSummary(year, month);
  const period = month ? month + " " + year : String(year);
  state.confirm = {
    title: "Reset progress for " + period + "?",
    detail: summary.wins + " win" + (summary.wins === 1 ? "" : "s") + " · " + fmt(summary.total) + " · " + summary.goals + " goal" + (summary.goals === 1 ? "" : "s"),
    message: "This deletes the selected winnings and goals. Your account, profile, sources, and other months stay untouched. This can't be undone.",
    confirmLabel: "Reset",
    onConfirm: () => {
      if (month) {
        state.wins = state.wins.filter((win) => !(win.year === year && win.month === month));
        delete state.goals[gk(month, year)];
      } else {
        state.wins = state.wins.filter((win) => win.year !== year);
        MONTHS.forEach((m) => { delete state.goals[gk(m, year)]; });
        delete state.goals[ygk(year)];
      }
      save();
      render();
      showToast("Reset " + period);
    },
  };
  render();
}

function downloadShareCard(): void {
  const canvas = document.getElementById("monthShareCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const report = activeShareReport();
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "Staxxs-" + report.fileLabel + ".png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Report downloaded");
}

function canvasPngFile(): Promise<File | null> {
  const canvas = document.getElementById("monthShareCanvas") as HTMLCanvasElement | null;
  if (!canvas) return Promise.resolve(null);
  const report = activeShareReport();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      resolve(new File([blob], "Staxxs-" + report.fileLabel + ".png", { type: "image/png" }));
    }, "image/png");
  });
}

async function shareReport(): Promise<void> {
  const report = activeShareReport();
  const text = "I made " + fmt(report.total) + " " + report.periodText + " on Staxxs.";
  const file = await canvasPngFile();
  const webShare = navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };
  if (file && webShare.share && (!webShare.canShare || webShare.canShare({ files: [file] }))) {
    try {
      await webShare.share({ title: "Staxxs " + report.title + " report", text, files: [file] });
      return;
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
  }
  downloadShareCard();
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  showToast("Image downloaded. Attach it to your X post.");
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function canvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2): number {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  words.forEach((word) => {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines++;
    } else {
      line = test;
    }
  });
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines++;
  }
  return y + Math.max(lines, 1) * lineHeight;
}

function fitCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "...").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.trimEnd() + "...";
}

function compactSourceRows(sources: [string, number][]): [string, number][] {
  if (sources.length <= 5) return sources;
  const visible = sources.slice(0, 5);
  const rest = sources.slice(5).reduce((sum, [, amount]) => sum + amount, 0);
  return [...visible, ["Other sources", rest]];
}

function drawMonthShareCard(th: Theme): void {
  if (!state.monthReport && !state.yearReport) return;
  const canvas = document.getElementById("monthShareCanvas") as HTMLCanvasElement | null;
  const logo = document.querySelector<HTMLImageElement>('img[alt="Staxxs logo"]');
  if (!canvas) return;
  const report = activeShareReport();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = 1080;
  const h = 1080;
  canvas.width = w;
  canvas.height = h;
  const dark = state.dark;

  ctx.clearRect(0, 0, w, h);

  const panelX = 2;
  const panelY = 2;
  const panelW = w - 4;
  const panelH = h - 4;
  ctx.fillStyle = dark ? "#252219" : "#FFFCF7";
  drawRoundRect(ctx, panelX, panelY, panelW, panelH, 48);
  ctx.fill();
  ctx.strokeStyle = th.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  if (logo?.complete && logo.naturalWidth) {
    ctx.drawImage(logo, 104, 104, 58, 58);
  } else {
    ctx.fillStyle = th.accent;
    drawRoundRect(ctx, 104, 104, 58, 58, 16);
    ctx.fill();
  }
  ctx.fillStyle = th.text;
  ctx.font = "700 42px Georgia, serif";
  ctx.fillText("Staxxs", 180, 149);
  ctx.fillStyle = th.sub;
  ctx.font = "800 32px 'DM Sans', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(report.title, 976, 143);
  ctx.textAlign = "left";

  ctx.fillStyle = th.sub;
  ctx.font = "700 26px 'DM Sans', Arial, sans-serif";
  ctx.fillText(report.eyebrow, 104, 256);
  ctx.fillStyle = th.accent;
  ctx.font = "700 104px Georgia, serif";
  ctx.fillText(fmt(report.total), 104, 360);

  ctx.fillStyle = th.text;
  ctx.font = "700 34px 'DM Sans', Arial, sans-serif";
  ctx.fillText(report.wins.length + " deal" + (report.wins.length === 1 ? "" : "s"), 108, 438);
  ctx.fillStyle = th.sub;
  ctx.font = "500 30px 'DM Sans', Arial, sans-serif";
  const sourceTextEnd = canvasText(ctx, "Top source: " + report.topSource, 108, 488, 820, 38, 2);

  const barX = 108;
  const barY = Math.max(568, sourceTextEnd + 44);
  const barW = 864;
  const barH = 24;
  const goalAmount = report.goal ? fmt(report.total) + " of " + fmt(report.goal) : "No goal set";
  const goalLabel = report.goal ? "Goal status · " + report.goalPct + "%" : "Goal status";
  ctx.fillStyle = th.text;
  ctx.font = "700 25px 'DM Sans', Arial, sans-serif";
  ctx.fillText(goalLabel, barX, barY - 22);
  ctx.fillStyle = th.sub;
  ctx.font = "600 23px 'DM Sans', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(goalAmount, barX + barW, barY - 22);
  ctx.textAlign = "left";
  ctx.fillStyle = th.barBg;
  drawRoundRect(ctx, barX, barY, barW, barH, 12);
  ctx.fill();
  const goalRatio = report.goal ? Math.min(report.total / report.goal, 1) : 0;
  const goalFillWidth = Math.max(report.goal && report.total > 0 ? 12 : 0, barW * goalRatio);
  const exceededGoal = report.goal > 0 && report.total >= report.goal;
  const goalGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  goalGrad.addColorStop(0, th.accent);
  goalGrad.addColorStop(1, exceededGoal ? th.green : "#DEB88A");
  if (goalFillWidth > 0) {
    ctx.fillStyle = goalGrad;
    drawRoundRect(ctx, barX, barY, goalFillWidth, barH, 12);
    ctx.fill();
  }

  const rows = compactSourceRows(report.sources);
  const denseSourceRows = rows.length > 4;
  const sourceHeadingY = barY + (denseSourceRows ? 68 : 80);
  const sourceRowStart = barY + (denseSourceRows ? 108 : 125);
  const sourceRowGap = denseSourceRows ? 47 : 62;
  const sourceNameSize = denseSourceRows ? 22 : 28;
  const sourceValueSize = denseSourceRows ? 20 : 25;
  const sourceBarHeight = denseSourceRows ? 12 : 16;
  const sourceBarOffset = denseSourceRows ? 16 : 20;
  const sourceNameWidth = denseSourceRows ? 430 : 520;

  ctx.fillStyle = th.sub;
  ctx.font = "700 24px 'DM Sans', Arial, sans-serif";
  ctx.fillText("SOURCE BREAKDOWN", 108, sourceHeadingY);

  const sourceMax = rows[0]?.[1] || report.total || 1;
  rows.forEach(([src, amount], index) => {
    const y = sourceRowStart + index * sourceRowGap;
    const sourcePct = report.total ? Math.round((amount / report.total) * 100) : 0;
    const barPct = Math.max(0.06, amount / sourceMax);
    ctx.fillStyle = th.text;
    ctx.font = `700 ${sourceNameSize}px 'DM Sans', Arial, sans-serif`;
    ctx.fillText(fitCanvasText(ctx, src, sourceNameWidth), 108, y);
    ctx.fillStyle = th.sub;
    ctx.font = `600 ${sourceValueSize}px 'DM Sans', Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(fmt(amount) + " · " + sourcePct + "%", 972, y);
    ctx.textAlign = "left";
    ctx.fillStyle = th.barBg;
    drawRoundRect(ctx, 108, y + sourceBarOffset, 864, sourceBarHeight, 10);
    ctx.fill();
    ctx.fillStyle = th.sc[src] || th.accent;
    drawRoundRect(ctx, 108, y + sourceBarOffset, 864 * barPct, sourceBarHeight, 10);
    ctx.fill();
  });

  if (report.sources.length === 0) {
    ctx.fillStyle = th.muted;
    ctx.font = "600 26px 'DM Sans', Arial, sans-serif";
    ctx.fillText("No source data yet", 108, barY + 135);
  }

  const foot = "Built with Staxxs";
  ctx.fillStyle = th.sub;
  ctx.font = "600 26px 'DM Sans', Arial, sans-serif";
  const footerY = denseSourceRows ? 985 : 950;
  ctx.fillText(foot, 108, footerY);
  ctx.textAlign = "right";
  ctx.fillText("@Staxxs", 972, footerY);
  ctx.textAlign = "left";
}

export function render(): void {
  const th: Theme = state.dark ? DARK : LIGHT;
  const wins = yw();
  if (!MONTHS.includes(state.summaryMonth)) state.summaryMonth = state.activeMonth || MONTHS[new Date().getMonth()];
  const summaryScope = state.summaryScope;
  const dm = state.summaryMonth;
  const selectedWins = summaryScope === "yearly" ? wins : wins.filter((w) => w.month === dm);
  const selectedTotal = selectedWins.reduce((s, w) => s + w.amount, 0);
  const cGoal = summaryScope === "yearly" ? state.goals[ygk(state.year)] : state.goals[gk(dm, state.year)];
  const cEarned = selectedTotal;
  const gPctRaw = cGoal ? (cEarned / cGoal) * 100 : 0;
  const gPct = Math.min(gPctRaw, 100);
  const exceeded = cGoal && cEarned > cGoal;
  const goalTitle = summaryScope === "yearly" ? state.year + " Yearly Goal" : dm + " Goal";
  const goalKey = summaryScope === "yearly" ? ygk(state.year) : gk(dm, state.year);
  let bestM = { m: "—", t: 0 };
  MONTHS.forEach((m) => { const v = wins.filter((w) => w.month === m).reduce((s, w) => s + w.amount, 0); if (v > bestM.t) bestM = { m, t: v }; });
  const bestMonth = bestM.t > 0 ? bestM.m + " (" + fmt(bestM.t) + ")" : "—";
  const srcMap: Record<string, number> = {};
  selectedWins.forEach((w) => { srcMap[w.source] = (srcMap[w.source] || 0) + w.amount; });
  let topSrc = { n: "—", t: 0 };
  Object.entries(srcMap).forEach(([n, v]) => { if (v > topSrc.t) topSrc = { n, t: v }; });
  const topSource = topSrc.t > 0 ? topSrc.n : "—";

  const displayWins = (state.winMonth ? wins.filter((w) => w.month === state.winMonth) : wins).sort((a, b) => monthIndex(a.month) - monthIndex(b.month));
  const displayTotal = displayWins.reduce((s, w) => s + w.amount, 0);
  const srcPool = state.sourceView === "monthly" ? wins.filter((w) => w.month === state.sourceMonth) : wins;
  const srcTotal = srcPool.reduce((s, w) => s + w.amount, 0);
  const srcBreakMap: Record<string, number> = {};
  srcPool.forEach((w) => { srcBreakMap[w.source] = (srcBreakMap[w.source] || 0) + w.amount; });
  const srcBreak = Object.entries(srcBreakMap).sort((a, b) => b[1] - a[1]);

  const app = $("#app")!;
  app.innerHTML = "";
  app.style.cssText = "min-height:100vh;transition:background .3s,color .3s;overflow-x:hidden;overflow-anchor:none;";
  app.style.background = th.bg;
  app.style.color = th.text;
  app.style.fontFamily = "'DM Sans',sans-serif";
  // Paint the page root with a SOLID color (not the gradient) so mobile browsers
  // tint the status-bar / safe-area to match. A gradient leaves background-color
  // transparent, which iOS samples as white — the cause of the top gap. Also keep
  // the theme-color meta in sync for the browser UI.
  const rootBg = state.dark ? "#1A1714" : "#FFFCF7";
  document.documentElement.style.backgroundColor = rootBg;
  document.body.style.backgroundColor = rootBg;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", rootBg);

  // Toast
  if (state.toast) {
    app.appendChild(el("div", { style: { position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", background: th.card, border: "1px solid " + th.accent, borderRadius: "10px", padding: "10px 20px", fontSize: "12px", color: th.accent, fontWeight: "600", zIndex: "100", boxShadow: "0 4px 16px rgba(0,0,0,.12)", animation: "fadeIn .2s ease" } }, state.toast));
  }

  // Header
  const hdr = el("div", { style: { padding: "28px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" } });
  const hdrL = el("div", {});
  const brand = el("button", { type: "button", style: { display: "flex", alignItems: "center", gap: "11px", padding: "0", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }, title: "Go home", onClick: () => { setTab("home"); window.scrollTo({ top: 0 }); render(); } });
  brand.appendChild(el("img", { src: LOGO_URL, alt: "Staxxs logo", width: "30", height: "30", style: { width: "30px", height: "30px", borderRadius: "8px", flexShrink: "0", boxShadow: "0 1px 4px rgba(0,0,0,.12)" } }));
  brand.appendChild(el("h1", { style: { fontFamily: "'Playfair Display',serif", fontSize: "26px", fontWeight: "700", margin: "0", color: th.text, letterSpacing: "-0.5px", lineHeight: "1" } }, "Staxxs"));
  hdrL.appendChild(brand);
  if (state.tab === "home") {
    hdrL.appendChild(el("p", { style: { margin: "8px 0 0", fontSize: "12px", color: th.sub, lineHeight: "1.4" } }, "Track your monthly wins, set earning goals, and watch your bags stack up."));
  }
  const hdrR = el("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" } });

  if (state.tab === "home") {
    const shareBtn = el("button", { type: "button", title: "Share earnings", style: { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: th.sub }, onClick: () => { state.showSharePicker = true; render(); } });
    shareBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
    const thBtn = el("button", { style: { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.dark = !state.dark; save(); render(); } });
    thBtn.innerHTML = state.dark ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    const yrL = el("button", { style: { width: "32px", height: "32px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", fontSize: "14px", color: th.sub, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.year--; render(); } }, "←");
    const yrR = el("button", { style: { width: "32px", height: "32px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", fontSize: "14px", color: th.sub, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.year++; render(); } }, "→");
    const yrSpan = el("span", { style: { fontFamily: "'Playfair Display',serif", fontSize: "20px", fontWeight: "600", color: th.text, minWidth: "48px", textAlign: "center" } }, String(state.year));
    hdrR.append(shareBtn, thBtn, yrL, yrSpan, yrR);
  }
  hdr.append(hdrL, hdrR);
  app.appendChild(hdr);

  if (state.showCSVPanel && state.tab !== "profile") app.appendChild(renderCSVPanel(th));

  if (state.tab === "home") {
  // Goal Card
  const gc = el("div", { style: { margin: "20px 20px 0", background: th.card, border: "1px solid " + th.border, borderRadius: "14px", padding: "18px" } });
  const gcTop = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" } });
  const gcL = el("div", {});
  gcL.appendChild(el("div", { style: { fontSize: "13px", fontWeight: "600", color: th.text } }, goalTitle));
  if (cGoal) {
    const sub = el("div", { style: { fontSize: "12px", color: th.sub, marginTop: "2px" } });
    sub.textContent = fmt(cEarned) + " of " + fmt(cGoal);
    if (exceeded) { const sp = el("span", { style: { color: th.green, fontWeight: "600" } }, " — Exceeded!"); sub.appendChild(sp); }
    gcL.appendChild(sub);
  } else gcL.appendChild(el("div", { style: { fontSize: "12px", color: th.muted, marginTop: "2px" } }, "No goal set"));

  const gcR = el("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" } });
  gcR.appendChild(mkDropdown(summaryScope === "yearly" ? "Year" : "Month", ["Month", "Year"], (v) => {
    state.summaryScope = v === "Year" ? "yearly" : "monthly";
    state.showGoalForm = false;
    render();
  }, th, { compact: true }));
  if (summaryScope === "monthly") {
    gcR.appendChild(mkDropdown(dm, MONTHS, (v) => {
      state.summaryMonth = v;
      state.activeMonth = v;
      state.showGoalForm = false;
      render();
    }, th, { compact: true, labelFn: (month) => MONTH_ABBREVIATIONS[MONTHS.indexOf(month)] || month }));
  }
  if (cGoal) gcR.appendChild(el("button", { style: { padding: "5px 10px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", cursor: "pointer", fontSize: "11px", color: th.accent, fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.confirm = { title: "Remove this goal?", detail: goalTitle + " — " + fmt(cGoal), message: "Your logged winnings stay; only the goal is removed.", confirmLabel: "Remove", onConfirm: () => { const g = { ...state.goals }; delete g[goalKey]; state.goals = g; save(); render(); } }; render(); } }, "Remove"));
  gcR.appendChild(el("button", { style: { padding: "5px 12px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, cursor: "pointer", fontSize: "11px", color: th.sub, fontFamily: "'DM Sans',sans-serif", fontWeight: "500" }, onClick: () => { state.goalForm = { month: summaryScope === "yearly" ? YEARLY_GOAL_LABEL : dm, target: cGoal ? String(cGoal) : "" }; state.editingGoalKey = cGoal ? goalKey : null; state.showGoalForm = !state.showGoalForm; render(); } }, cGoal ? "Edit" : "Set Goal"));
  gcTop.append(gcL, gcR);
  gc.appendChild(gcTop);

  // Progress bar
  const bar = el("div", { style: { width: "100%", height: "24px", background: th.barBg, borderRadius: "12px", overflow: "hidden", position: "relative" } });
  const fill = el("div", { style: { width: cGoal ? gPct + "%" : "0%", height: "100%", background: exceeded ? th.greenGrad : th.accentGrad, borderRadius: "12px", transition: "width .8s cubic-bezier(.4,0,.2,1)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: gPct > 15 ? "10px" : "0" } });
  if (cGoal && gPct > 15) fill.appendChild(el("span", { style: { fontSize: "11px", fontWeight: "700", color: "#FFFCF7", textShadow: "0 1px 2px rgba(0,0,0,.2)" } }, Math.round(gPctRaw) + "%"));
  bar.appendChild(fill);
  if (cGoal && gPct <= 15) bar.appendChild(el("span", { style: { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", fontWeight: "600", color: th.sub } }, Math.round(gPctRaw) + "%"));
  gc.appendChild(bar);

  // Mini month bars
  const miniRow = el("div", { style: { display: "flex", gap: "3px", marginTop: "12px", flexWrap: "wrap" } });
  MONTHS.forEach((m, index) => {
    const g = state.goals[gk(m, state.year)];
    const e = wins.filter((w) => w.month === m).reduce((s, w) => s + w.amount, 0);
    const p = g ? Math.min((e / g) * 100, 100) : 0;
    const hit = g && e >= g;
    const isA = m === dm;
    const d = el("div", { style: { flex: "1 1 68px", minWidth: "58px", cursor: "pointer", textAlign: "center" }, onClick: () => { state.summaryScope = "monthly"; state.summaryMonth = m; state.activeMonth = m; render(); } });
    d.appendChild(el("div", { style: { fontSize: "8px", color: isA ? th.text : th.muted, fontWeight: isA ? "600" : "400", marginBottom: "2px" } }, MONTH_ABBREVIATIONS[index] || m));
    const b = el("div", { style: { height: "5px", background: th.barBg, borderRadius: "3px", overflow: "hidden" } });
    b.appendChild(el("div", { style: { width: g ? p + "%" : "0%", height: "100%", background: hit ? th.green : th.accent, borderRadius: "3px", transition: "width .5s ease" } }));
    d.appendChild(b);
    miniRow.appendChild(d);
  });
  gc.appendChild(miniRow);

  // Goal form
  if (state.showGoalForm) {
    const gf = el("div", { style: { marginTop: "14px", padding: "14px", background: th.input, borderRadius: "10px", animation: "fadeIn .2s ease" } });
    const row = el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" } });
    const isYearlyGoalForm = state.goalForm.month === YEARLY_GOAL_LABEL;
    const mSel = isYearlyGoalForm
      ? el("div", {}, [
        el("label", { style: { fontSize: "11px", color: th.sub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block" } }, "Period"),
        el("div", { style: { padding: "10px 12px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.card, fontSize: "14px", color: th.text, fontWeight: "700" } }, state.year + " yearly goal"),
      ])
      : mkSelect(state.goalForm.month, MONTHS, (v) => { state.goalForm.month = v; state.summaryMonth = v; }, "Month", th);
    const tInp = mkInput(state.goalForm.target, "500", (v) => { state.goalForm.target = v; }, "Target ($)", "number", th);
    row.append(mSel, tInp);
    gf.appendChild(row);
    const btns = el("div", { style: { display: "flex", gap: "8px" } });
    btns.appendChild(el("button", { style: { flex: "1", padding: "10px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { const v = parseFloat(state.goalForm.target); if (isNaN(v) || v <= 0) return; const key = state.editingGoalKey || (state.goalForm.month === YEARLY_GOAL_LABEL ? ygk(state.year) : gk(state.goalForm.month, state.year)); state.goals[key] = v; state.showGoalForm = false; state.editingGoalKey = null; save(); render(); } }, state.editingGoalKey ? "Update" : "Set Goal"));
    btns.appendChild(el("button", { style: { padding: "10px 14px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.showGoalForm = false; render(); } }, "Cancel"));
    gf.appendChild(btns);
    gc.appendChild(gf);
  }
  app.appendChild(gc);

  // Stats
  const stats: { label: string; value: string | number; ac: string }[] = [
    { label: "Total Earned", value: fmt(selectedTotal), ac: th.accent },
    { label: "Total Deals", value: selectedWins.length, ac: th.sub },
    { label: "Best Month", value: bestMonth, ac: state.dark ? "#C0724D" : "#A0522D" },
    { label: "Top Source", value: topSource, ac: state.dark ? "#DEB88A" : "#D4A574" },
  ];
  const sg = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "10px", padding: "18px 20px 0" } });
  stats.forEach((s) => {
    const c = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "12px", padding: "14px 16px", position: "relative", overflow: "hidden" } });
    c.appendChild(el("div", { style: { position: "absolute", top: "0", left: "0", width: "3px", height: "100%", background: s.ac, borderRadius: "12px 0 0 12px" } }));
    c.appendChild(el("div", { style: { fontSize: "10px", color: th.sub, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "5px" } }, s.label));
    c.appendChild(el("div", { style: { fontSize: "17px", fontWeight: "700", color: th.accent, wordBreak: "break-word" } }, String(s.value)));
    sg.appendChild(c);
  });
  app.appendChild(sg);

  // Chart
  const chartCard = el("div", { style: { margin: "18px 20px 0", background: th.card, border: "1px solid " + th.border, borderRadius: "14px", padding: "18px 12px 14px" } });
  const chartHdr = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", padding: "0 6px" } });
  chartHdr.appendChild(el("span", { style: { fontSize: "13px", fontWeight: "600", color: th.text } }, "Monthly Earnings"));
  const ctSel = mkDropdown(state.chartType, CHART_TYPES, (v) => { state.chartType = v; render(); }, th, { compact: true, labelFn: (o) => o + " Chart" });
  chartHdr.appendChild(ctSel);
  chartCard.appendChild(chartHdr);

  const isPie = state.chartType.toLowerCase() === "pie";
  const canvas = el("canvas", { id: "mainChart", style: { width: "100%", height: isPie ? "360px" : "300px", maxHeight: isPie ? "360px" : "300px", display: "block" } });
  chartCard.appendChild(canvas);
  app.appendChild(chartCard);

  // Add button
  const addWrap = el("div", { style: { padding: "18px 20px 0" } });
  addWrap.appendChild(el("button", { style: { width: "100%", padding: "12px", borderRadius: "10px", border: "2px dashed " + th.border, background: "transparent", cursor: "pointer", fontSize: "13px", color: th.sub, fontFamily: "'DM Sans',sans-serif", fontWeight: "600" }, onClick: () => { state.showAddForm = !state.showAddForm; state.addForm = { month: MONTHS[new Date().getMonth()], project: "", amount: "", source: "Bounties" }; render(); } }, "+ Log a New Bag"));
  app.appendChild(addWrap);

  // Add form
  if (state.showAddForm) {
    const af = el("div", { style: { margin: "14px 20px 0", background: th.card, border: "1px solid " + th.border, borderRadius: "12px", padding: "18px", animation: "fadeIn .2s ease" } });
    const r1 = el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" } });
    r1.append(mkSelect(state.addForm.month, MONTHS, (v) => { state.addForm.month = v; }, "Month", th), mkInput(state.addForm.amount, "0.00", (v) => { state.addForm.amount = v; }, "Amount ($)", "number", th));
    af.appendChild(r1);
    const r2 = el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" } });
    r2.append(mkInput(state.addForm.project, "e.g. Project Name", (v) => { state.addForm.project = v; }, "Project *", "text", th), mkSelect(state.addForm.source, state.sources, (v) => { state.addForm.source = v; }, "Source", th));
    af.appendChild(r2);
    const btns = el("div", { style: { display: "flex", gap: "8px" } });
    btns.appendChild(el("button", { style: { flex: "1", padding: "11px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { if (!state.addForm.project.trim() || !state.addForm.amount) return; const amt = parseFloat(state.addForm.amount); if (isNaN(amt) || amt <= 0) return; state.wins.push({ id: gid(), month: state.addForm.month, project: state.addForm.project.trim(), amount: amt, year: state.year, source: state.addForm.source }); state.showAddForm = false; save(); render(); } }, "Log This Bag"));
    btns.appendChild(el("button", { style: { padding: "11px 16px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.showAddForm = false; render(); } }, "Cancel"));
    af.appendChild(btns);
    app.appendChild(af);
  }

  // Bottom: Winnings + Sources
  const bottom = el("div", { style: { padding: "18px 20px 20px", display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" } });

  // Winnings list
  const wCol = el("div", { style: { flex: "1 1 300px", minWidth: "0" } });
  wCol.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "600", color: th.text, marginBottom: "10px" } }, "Winnings"));
  const pills = el("div", { style: { display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" } });
  pills.appendChild(mkPill("All", !state.winMonth, () => { state.winMonth = null; render(); }, th));
  MONTHS.forEach((m) => { const c = wins.filter((w) => w.month === m).length; if (c > 0) pills.appendChild(mkPill(m + " (" + c + ")", state.winMonth === m, () => { state.winMonth = state.winMonth === m ? null : m; render(); }, th)); });
  wCol.appendChild(pills);
  if (state.winMonth) {
    const monthTotal = el("div", { style: { fontSize: "12px", color: th.sub, marginBottom: "8px" } });
    monthTotal.append(state.winMonth + " Total: ", el("span", { style: { fontWeight: "700", color: th.text } }, fmt(displayTotal)));
    wCol.appendChild(monthTotal);
  }

  if (displayWins.length === 0) {
    const empty = el("div", { style: { textAlign: "center", padding: "36px 16px", color: th.muted, fontSize: "13px", background: th.card, border: "1px solid " + th.border, borderRadius: "12px" } });
    empty.append(
      state.winMonth ? "Nothing for " + state.winMonth + " yet" : "No bags for " + state.year + " yet",
      el("br"),
      el("span", { style: { fontSize: "11px", marginTop: "4px", display: "inline-block" } }, "Log your first win above"),
    );
    wCol.appendChild(empty);
  } else {
    const wList = el("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } });
    displayWins.forEach((win) => {
      if (state.editingId === win.id) {
        // Edit form
        const ef = el("div", { style: { background: th.input, border: "1px solid " + th.accent, borderRadius: "10px", padding: "14px", animation: "fadeIn .15s ease" } });
        ef.appendChild(el("div", { style: { fontSize: "11px", color: th.accent, fontWeight: "600", marginBottom: "10px" } }, "Editing: " + win.project));
        const r1 = el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" } });
        r1.append(mkSelect(state.editForm.month, MONTHS, (v) => { state.editForm.month = v; }, "Month", th), mkInput(state.editForm.amount, "", (v) => { state.editForm.amount = v; }, "Amount ($)", "number", th));
        ef.appendChild(r1);
        const r2 = el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" } });
        r2.append(mkInput(state.editForm.project, "", (v) => { state.editForm.project = v; }, "Project", "text", th), mkSelect(state.editForm.source, state.sources, (v) => { state.editForm.source = v; }, "Source", th));
        ef.appendChild(r2);
        const btns = el("div", { style: { display: "flex", gap: "6px" } });
        btns.appendChild(el("button", { style: { flex: "1", padding: "9px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { if (!state.editForm.project.trim() || !state.editForm.amount) return; const amt = parseFloat(state.editForm.amount); if (isNaN(amt) || amt <= 0) return; const w = state.wins.find((w) => w.id === state.editingId); if (w) { w.month = state.editForm.month; w.project = state.editForm.project.trim(); w.amount = amt; w.source = state.editForm.source; } state.editingId = null; save(); render(); } }, "Save"));
        btns.appendChild(el("button", { style: { padding: "9px 14px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.editingId = null; render(); } }, "Cancel"));
        ef.appendChild(btns);
        wList.appendChild(ef);
      } else {
        const row = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "10px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px" } });
        row.appendChild(el("div", { style: { width: "3px", height: "38px", borderRadius: "3px", background: th.sc[win.source] || th.muted, flexShrink: "0" } }));
        const info = el("div", { style: { flex: "1", minWidth: "0" } });
        const tags = el("div", { style: { display: "flex", alignItems: "center", gap: "5px", marginBottom: "1px", flexWrap: "wrap" } });
        tags.appendChild(el("span", { style: { fontSize: "12px", fontWeight: "600", color: th.text } }, win.project));
        tags.appendChild(el("span", { style: { fontSize: "8px", background: th.tag, color: th.sub, padding: "2px 6px", borderRadius: "8px" } }, win.month));
        tags.appendChild(el("span", { style: { fontSize: "8px", background: th.sc[win.source] || th.muted, color: "#FFFCF7", padding: "2px 6px", borderRadius: "8px" } }, win.source));
        info.appendChild(tags);
        info.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "700", color: th.accent, fontFamily: "'Playfair Display',serif" } }, fmt(win.amount)));
        row.appendChild(info);
        const acts = el("div", { style: { display: "flex", gap: "3px", flexShrink: "0" } });
        acts.appendChild(el("button", { style: { width: "28px", height: "28px", borderRadius: "6px", border: "1px solid " + th.border, background: th.input, cursor: "pointer", fontSize: "11px", color: th.sub, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.editForm = { month: win.month, project: win.project, amount: String(win.amount), source: win.source || "Other" }; state.editingId = win.id; render(); } }, "✎"));
        acts.appendChild(el("button", { style: { width: "28px", height: "28px", borderRadius: "6px", border: "1px solid " + th.border, background: th.input, cursor: "pointer", fontSize: "11px", color: th.accent, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.confirm = { title: "Delete this winning?", detail: win.project + " — " + win.month + " " + win.year + " · " + fmt(win.amount), message: "This removes it from your winnings and can't be undone.", confirmLabel: "Delete", onConfirm: () => { state.wins = state.wins.filter((w) => w.id !== win.id); if (state.editingId === win.id) state.editingId = null; save(); render(); } }; render(); } }, "×"));
        row.appendChild(acts);
        wList.appendChild(row);
      }
    });
    wCol.appendChild(wList);
  }
  bottom.appendChild(wCol);

  // Sources
  const sCol = el("div", { style: { flex: "1 1 260px", minWidth: "0", maxWidth: "360px" } });
  const sHdr = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } });
  const sHdrL = el("div", { style: { display: "flex", alignItems: "center", gap: "6px" } });
  sHdrL.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "600", color: th.text } }, "Sources"));
  const gearBtn = el("button", { style: { width: "22px", height: "22px", borderRadius: "6px", border: "1px solid " + th.border, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.showSourceManager = !state.showSourceManager; render(); } });
  gearBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="' + th.muted + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  sHdrL.appendChild(gearBtn);
  sHdr.appendChild(sHdrL);
  const svTabs = el("div", { style: { display: "flex", background: th.toggleBg, borderRadius: "8px", padding: "2px" } });
  svTabs.appendChild(el("button", { style: { padding: "5px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: state.sourceView === "yearly" ? "600" : "400", background: state.sourceView === "yearly" ? th.accent : "transparent", color: state.sourceView === "yearly" ? "#FFFCF7" : th.sub, fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.sourceView = "yearly"; render(); } }, "Yearly"));
  svTabs.appendChild(el("button", { style: { padding: "5px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: state.sourceView === "monthly" ? "600" : "400", background: state.sourceView === "monthly" ? th.accent : "transparent", color: state.sourceView === "monthly" ? "#FFFCF7" : th.sub, fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.sourceView = "monthly"; render(); } }, "Monthly"));
  sHdr.appendChild(svTabs);
  sCol.appendChild(sHdr);

  // Source manager
  if (state.showSourceManager) {
    const sm = el("div", { style: { marginBottom: "14px", padding: "14px", background: th.input, borderRadius: "10px", animation: "fadeIn .15s ease" } });
    sm.appendChild(el("div", { style: { fontSize: "11px", color: th.sub, fontWeight: "600", marginBottom: "8px" } }, "Manage Sources"));
    const tags = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" } });
    state.sources.forEach((s) => {
      const tag = el("div", { style: { display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px 4px 10px", borderRadius: "8px", background: th.card, border: "1px solid " + th.border, fontSize: "11px", color: th.text } });
      tag.appendChild(el("span", {}, s));
      if (s !== OTHER_SOURCE) {
        tag.appendChild(el("button", { style: { width: "16px", height: "16px", borderRadius: "4px", border: "none", background: "transparent", cursor: "pointer", fontSize: "10px", color: th.muted, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { const used = state.wins.filter((w) => w.source === s).length; state.confirm = { title: 'Remove "' + s + '"?', message: used > 0 ? used + " winning" + (used === 1 ? "" : "s") + " using this source will be moved to Other." : "No winnings use this source.", confirmLabel: "Remove", onConfirm: () => { state.sources = state.sources.filter((x) => x !== s); if (!state.sources.includes(OTHER_SOURCE)) state.sources.push(OTHER_SOURCE); state.wins = state.wins.map((w) => w.source === s ? { ...w, source: OTHER_SOURCE } : w); if (state.addForm.source === s) state.addForm.source = OTHER_SOURCE; if (state.editForm.source === s) state.editForm.source = OTHER_SOURCE; save(); render(); showToast('Removed "' + s + '"'); } }; render(); } }, "×"));
      }
      tags.appendChild(tag);
    });
    sm.appendChild(tags);
    const addRow = el("div", { style: { display: "flex", gap: "6px" } });
    const nsInp = el("input", { type: "text", placeholder: "New source name", style: { flex: "1", padding: "10px 12px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, fontSize: "16px", color: th.text, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" } }) as HTMLInputElement;
    nsInp.value = state.newSource;
    nsInp.oninput = (e) => { state.newSource = (e.target as HTMLInputElement).value; };
    nsInp.onkeydown = (e) => { if ((e as KeyboardEvent).key === "Enter") doAddSource(); };
    addRow.appendChild(nsInp);
    addRow.appendChild(el("button", { style: { padding: "8px 14px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }, onClick: () => doAddSource() }, "Add"));
    sm.appendChild(addRow);
    sCol.appendChild(sm);
  }

  // Source month pills
  if (state.sourceView === "monthly") {
    const mp = el("div", { style: { display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" } });
    MONTHS.forEach((m) => mp.appendChild(mkPill(m, state.sourceMonth === m, () => { state.sourceMonth = m; render(); }, th)));
    sCol.appendChild(mp);
  }

  if (srcBreak.length === 0) {
    sCol.appendChild(el("div", { style: { textAlign: "center", padding: "28px 14px", color: th.muted, fontSize: "12px", background: th.card, border: "1px solid " + th.border, borderRadius: "12px" } }, state.sourceView === "monthly" ? "No data for " + state.sourceMonth : "No data yet"));
  } else {
    const sc = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "12px", padding: "16px" } });
    const sl = el("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
    srcBreak.forEach(([src, amt]) => {
      const pct = srcTotal > 0 ? (amt / srcTotal) * 100 : 0;
      const d = el("div", {});
      const top = el("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } });
      const lbl = el("div", { style: { display: "flex", alignItems: "center", gap: "5px" } });
      lbl.appendChild(el("div", { style: { width: "7px", height: "7px", borderRadius: "50%", background: th.sc[src] || th.muted } }));
      lbl.appendChild(el("span", { style: { fontSize: "11px", color: th.text, fontWeight: "500" } }, src));
      top.appendChild(lbl);
      top.appendChild(el("span", { style: { fontSize: "11px", color: th.sub, fontWeight: "600" } }, fmt(amt)));
      d.appendChild(top);
      const barEl = el("div", { style: { height: "7px", background: th.barBg, borderRadius: "4px", overflow: "hidden" } });
      barEl.appendChild(el("div", { style: { width: pct + "%", height: "100%", background: th.sc[src] || th.muted, borderRadius: "4px", transition: "width .5s ease" } }));
      d.appendChild(barEl);
      d.appendChild(el("div", { style: { fontSize: "9px", color: th.muted, marginTop: "2px", textAlign: "right" } }, Math.round(pct) + "%"));
      sl.appendChild(d);
    });
    sc.appendChild(sl);
    const tot = el("div", { style: { marginTop: "14px", paddingTop: "12px", borderTop: "1px solid " + th.border, display: "flex", justifyContent: "space-between" } });
    tot.appendChild(el("span", { style: { fontSize: "11px", fontWeight: "600", color: th.text } }, "Total"));
    tot.appendChild(el("span", { style: { fontSize: "13px", fontWeight: "700", color: th.accent, fontFamily: "'Playfair Display',serif" } }, fmt(srcTotal)));
    sc.appendChild(tot);
    sCol.appendChild(sc);
  }
  bottom.appendChild(sCol);
  app.appendChild(bottom);

  // Footer tip
  const footer = el("div", { style: { textAlign: "center", padding: "0 20px 24px" } });
  footer.appendChild(el("p", { style: { fontSize: "10px", color: th.muted, margin: "0", lineHeight: "1.5" } }, state.user ? "Synced to your account — " + state.user.email : cloudEnabled() ? "Sign in to sync your bags across devices. Your data is saved locally too." : "Your data lives in this browser. Export CSV regularly to back up or switch devices."));
  app.appendChild(footer);
  } else if (state.tab === "insights") {
    app.appendChild(renderInsights(th));
  } else {
    app.appendChild(renderProfile(th));
  }

  // Spacer so content clears the floating nav bar
  app.appendChild(el("div", { style: { height: "88px" } }));
  // Floating glass navigation bar (bottom)
  app.appendChild(renderNav(th));

  // Auth modal
  if (state.showAuth) app.appendChild(renderAuthModal(th));
  if (state.showProfileSetup && state.user) app.appendChild(renderProfileSetupModal(th));
  if (state.showSharePicker) app.appendChild(renderSharePickerModal(th));
  if (state.monthReport || state.yearReport) app.appendChild(renderMonthReportModal(th));
  if (state.chartBreakdownMonth) app.appendChild(renderChartBreakdownModal(th));

  // Confirmation popup for any destructive action (delete / remove / reset)
  if (state.confirm) app.appendChild(renderConfirm(th));

  // Render chart
  renderChart(th, wins, (month) => { openChartBreakdown(month); });
  requestAnimationFrame(() => {
    drawMonthShareCard(th);
  });
}

/** Floating liquid-glass navigation bar (bottom, same on mobile + desktop). */
function renderCSVPanel(th: Theme, embedded = false): HTMLElement {
  const cp = el("div", { style: embedded ? { marginTop: "14px", paddingTop: "14px", borderTop: "1px solid " + th.border, animation: "fadeIn .2s ease" } : { margin: "16px 20px 0", background: th.card, border: "1px solid " + th.border, borderRadius: "14px", padding: "18px", animation: "fadeIn .2s ease" } });
  const tabs = el("div", { style: { display: "flex", background: th.toggleBg, borderRadius: "8px", padding: "2px", marginBottom: "14px", width: "fit-content" } });
  const mkTab = (label: string, mode: "export" | "import") => el("button", { style: { padding: "5px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: state.csvMode === mode ? "600" : "400", background: state.csvMode === mode ? th.accent : "transparent", color: state.csvMode === mode ? "#FFFCF7" : th.sub, fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.csvMode = mode; state.csvText = ""; render(); } }, label);
  tabs.append(mkTab("Export CSV", "export"), mkTab("Import CSV", "import"));
  cp.appendChild(tabs);

  if (state.csvMode === "export") {
    cp.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, marginBottom: "10px" } }, "Export all your data as CSV. Copy to clipboard, download as file, or paste into Google Sheets / Excel."));
    const btns = el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } });
    btns.appendChild(el("button", { style: { flex: "1", minWidth: "120px", padding: "11px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => exportCSV() }, "Export to Clipboard"));
    btns.appendChild(el("button", { style: { flex: "1", minWidth: "120px", padding: "11px", borderRadius: "8px", border: "1px solid " + th.accent, background: "transparent", color: th.accent, fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => downloadCSV() }, "Download .csv File"));
    btns.appendChild(el("button", { style: { padding: "11px 16px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.showCSVPanel = false; render(); } }, "Close"));
    cp.appendChild(btns);
    if (state.csvText) {
      const ta = el("textarea", { style: { width: "100%", marginTop: "12px", padding: "10px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, color: th.text, fontSize: "11px", fontFamily: "monospace", minHeight: "120px", resize: "vertical", outline: "none", boxSizing: "border-box" }, readOnly: "true" }) as HTMLTextAreaElement;
      ta.value = state.csvText;
      ta.onclick = () => ta.select();
      cp.appendChild(ta);
    }
  } else {
    cp.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, marginBottom: "6px" } }, "Paste CSV data below or upload a .csv file — wins and goals both get imported"));
    cp.appendChild(el("p", { style: { fontSize: "10px", color: th.muted, marginBottom: "10px" } }, "Wins: Year,Month,Project,Amount,Source — Goals: GOAL,Year,Month,Target"));
    const fileLabel = el("label", { style: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid " + th.accent, background: "transparent", color: th.accent, fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: "10px" } });
    fileLabel.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload .csv file';
    const fi = el("input", { type: "file", accept: ".csv,.txt", style: { display: "none" } }) as HTMLInputElement;
    fi.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => { state.csvText = (ev.target?.result as string) || ""; state.csvMode = "import"; render(); showToast("File loaded — click Import Data to apply"); };
      r.readAsText(f);
    };
    fileLabel.appendChild(fi);
    cp.appendChild(fileLabel);

    const ta = el("textarea", { style: { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, color: th.text, fontSize: "11px", fontFamily: "monospace", minHeight: "120px", resize: "vertical", outline: "none", boxSizing: "border-box" }, placeholder: "Year,Month,Project,Amount,Source\n2026,January,MyProject,100,Bounties" }) as HTMLTextAreaElement;
    ta.value = state.csvText;
    ta.oninput = (e) => { state.csvText = (e.target as HTMLTextAreaElement).value; };
    cp.appendChild(ta);
    const btns = el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } });
    btns.appendChild(el("button", { style: { flex: "1", padding: "11px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => importCSV() }, "Import Data"));
    btns.appendChild(el("button", { style: { padding: "11px 16px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.showCSVPanel = false; state.csvText = ""; render(); } }, "Close"));
    cp.appendChild(btns);
  }
  return cp;
}

function renderSharePickerModal(th: Theme): HTMLElement {
  const close = () => { state.showSharePicker = false; render(); };
  const ov = el("div", { style: { position: "fixed", inset: "0", background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "207", padding: "20px", animation: "fadeIn .2s ease" } });
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const card = el("div", { style: { width: "min(420px,100%)", maxHeight: "92vh", overflowY: "auto", background: th.card, border: "1px solid " + th.border, borderRadius: "18px", padding: "22px", boxShadow: "0 18px 54px rgba(0,0,0,.32)" } });
  const top = el("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" } });
  const title = el("div", {});
  title.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "24px", lineHeight: "1.1", color: th.text, margin: "0 0 4px" } }, "Share earnings"));
  title.appendChild(el("p", { style: { color: th.sub, fontSize: "12px", lineHeight: "1.45", margin: "0" } }, "Choose a month or the full year."));
  top.appendChild(title);
  top.appendChild(el("button", { type: "button", title: "Close", style: { width: "32px", height: "32px", borderRadius: "50%", border: "1px solid " + th.border, background: "transparent", color: th.sub, cursor: "pointer", fontSize: "18px", lineHeight: "1", flexShrink: "0" }, onClick: () => close() }, "×"));
  card.appendChild(top);

  const yearTotal = yw().reduce((sum, win) => sum + win.amount, 0);
  const yearBtn = el("button", { type: "button", style: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px", borderRadius: "14px", border: "1px solid " + th.border, background: th.input, color: th.text, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: "14px", textAlign: "left" }, onClick: () => openYearReport() });
  yearBtn.append(
    el("span", { style: { display: "flex", flexDirection: "column", gap: "3px" } }, [
      el("span", { style: { fontSize: "13px", fontWeight: "800" } }, String(state.year)),
      el("span", { style: { fontSize: "11px", color: th.sub } }, "Full-year report"),
    ]),
    el("span", { style: { fontSize: "14px", fontWeight: "800", color: th.accent } }, fmt(yearTotal)),
  );
  card.appendChild(yearBtn);

  card.appendChild(el("div", { style: { fontSize: "10px", color: th.sub, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" } }, "Months"));
  const grid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(108px,1fr))", gap: "8px" } });
  MONTHS.forEach((month) => {
    const total = yw().filter((win) => win.month === month).reduce((sum, win) => sum + win.amount, 0);
    const btn = el("button", { type: "button", disabled: total <= 0, style: { padding: "11px 10px", borderRadius: "12px", border: "1px solid " + th.border, background: total > 0 ? th.card : th.input, color: total > 0 ? th.text : th.muted, cursor: total > 0 ? "pointer" : "default", fontFamily: "'DM Sans',sans-serif", textAlign: "left", opacity: total > 0 ? "1" : ".55" }, onClick: () => { if (total > 0) openMonthReport(month); } });
    btn.append(
      el("div", { style: { fontSize: "12px", fontWeight: "800", marginBottom: "3px" } }, month),
      el("div", { style: { fontSize: "11px", color: total > 0 ? th.accent : th.muted, fontWeight: "700" } }, total > 0 ? fmt(total) : "No data"),
    );
    grid.appendChild(btn);
  });
  card.appendChild(grid);
  ov.appendChild(card);
  return ov;
}

function renderChartBreakdownModal(th: Theme): HTMLElement {
  const month = state.chartBreakdownMonth || MONTHS[new Date().getMonth()];
  const report = monthReportData(month);
  const close = () => closeChartBreakdown();
  const ov = el("div", { style: { position: "fixed", inset: "0", background: "rgba(0,0,0,.56)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "208", padding: "20px", animation: "fadeIn .2s ease" } });
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const card = el("div", { style: { width: "min(760px,100%)", maxHeight: "92vh", overflowY: "auto", background: th.card, border: "1px solid " + th.border, borderRadius: "22px", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" } });
  const top = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "18px" } });
  const title = el("div", {});
  title.appendChild(el("div", { style: { fontSize: "11px", color: th.sub, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" } }, "Monthly breakdown"));
  title.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "30px", lineHeight: "1.1", color: th.text, margin: "0" } }, month + " " + state.year));
  title.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "7px 0 0", lineHeight: "1.45" } }, report.wins.length + " deal" + (report.wins.length === 1 ? "" : "s") + " logged for this month."));
  top.appendChild(title);
  top.appendChild(el("button", { type: "button", title: "Close", style: { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: "transparent", color: th.sub, cursor: "pointer", fontSize: "20px", lineHeight: "1", flexShrink: "0" }, onClick: () => close() }, "×"));
  card.appendChild(top);

  const summary = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", marginBottom: "16px" } });
  [
    ["Total earned", fmt(report.total)],
    ["Total deals", String(report.wins.length)],
    ["Top source", report.topSource],
    ["Biggest win", report.biggestWin ? fmt(report.biggestWin.amount) : "—"],
  ].forEach(([label, value]) => {
    const box = el("div", { style: { background: th.input, border: "1px solid " + th.border, borderRadius: "14px", padding: "13px 14px" } });
    box.appendChild(el("div", { style: { fontSize: "10px", color: th.sub, textTransform: "uppercase", letterSpacing: "1px", fontWeight: "800", marginBottom: "6px" } }, label));
    box.appendChild(el("div", { style: { fontSize: "17px", color: th.accent, fontWeight: "800", wordBreak: "break-word" } }, value));
    summary.appendChild(box);
  });
  card.appendChild(summary);

  if (report.goal) {
    const pct = Math.round((report.total / report.goal) * 100);
    const fillPct = Math.min(pct, 100);
    const goal = el("div", { style: { background: th.input, border: "1px solid " + th.border, borderRadius: "14px", padding: "14px", marginBottom: "16px" } });
    const row = el("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "9px", flexWrap: "wrap" } });
    row.appendChild(el("span", { style: { fontSize: "12px", fontWeight: "800", color: th.text } }, "Goal status · " + pct + "%"));
    row.appendChild(el("span", { style: { fontSize: "12px", fontWeight: "700", color: th.sub } }, fmt(report.total) + " of " + fmt(report.goal)));
    goal.appendChild(row);
    const bar = el("div", { style: { width: "100%", height: "12px", background: th.barBg, borderRadius: "999px", overflow: "hidden" } });
    bar.appendChild(el("div", { style: { width: fillPct + "%", height: "100%", background: report.total >= report.goal ? th.greenGrad : th.accentGrad, borderRadius: "999px" } }));
    goal.appendChild(bar);
    card.appendChild(goal);
  }

  const sources = el("div", { style: { marginBottom: "16px" } });
  sources.appendChild(el("h3", { style: { fontSize: "13px", color: th.text, margin: "0 0 10px", fontWeight: "800" } }, "Source breakdown"));
  if (report.sources.length === 0) {
    sources.appendChild(el("div", { style: { padding: "18px", borderRadius: "14px", border: "1px solid " + th.border, background: th.input, color: th.muted, fontSize: "12px", textAlign: "center" } }, "No source data for this month yet."));
  } else {
    const max = report.sources[0]?.[1] || report.total || 1;
    report.sources.forEach(([source, amount]) => {
      const pct = report.total ? Math.round((amount / report.total) * 100) : 0;
      const row = el("div", { style: { padding: "12px 0", borderBottom: "1px solid " + th.border } });
      const line = el("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "7px", alignItems: "baseline" } });
      line.appendChild(el("span", { style: { fontSize: "13px", fontWeight: "800", color: th.text } }, source));
      line.appendChild(el("span", { style: { fontSize: "12px", fontWeight: "800", color: th.accent, whiteSpace: "nowrap" } }, fmt(amount) + " · " + pct + "%"));
      row.appendChild(line);
      const bar = el("div", { style: { height: "8px", borderRadius: "999px", overflow: "hidden", background: th.barBg } });
      bar.appendChild(el("div", { style: { width: Math.max(4, (amount / max) * 100) + "%", height: "100%", borderRadius: "999px", background: th.sc[source] || th.accent } }));
      row.appendChild(bar);
      sources.appendChild(row);
    });
  }
  card.appendChild(sources);

  const winsList = el("div", {});
  winsList.appendChild(el("h3", { style: { fontSize: "13px", color: th.text, margin: "0 0 10px", fontWeight: "800" } }, "Deals"));
  const sortedWins = [...report.wins].sort((a, b) => b.amount - a.amount || a.project.localeCompare(b.project));
  if (sortedWins.length === 0) {
    winsList.appendChild(el("div", { style: { padding: "18px", borderRadius: "14px", border: "1px solid " + th.border, background: th.input, color: th.muted, fontSize: "12px", textAlign: "center" } }, "No deals logged for " + month + " yet."));
  } else {
    sortedWins.forEach((win) => {
      const row = el("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + th.border } });
      const left = el("div", {});
      left.appendChild(el("div", { style: { fontSize: "13px", color: th.text, fontWeight: "800", marginBottom: "4px", wordBreak: "break-word" } }, win.project));
      left.appendChild(el("div", { style: { fontSize: "11px", color: th.sub } }, win.source || OTHER_SOURCE));
      row.appendChild(left);
      row.appendChild(el("div", { style: { fontSize: "14px", color: th.accent, fontWeight: "900", whiteSpace: "nowrap" } }, fmt(win.amount)));
      winsList.appendChild(row);
    });
  }
  card.appendChild(winsList);
  ov.appendChild(card);
  return ov;
}

function renderMonthReportModal(th: Theme): HTMLElement {
  const close = () => closeShareReport();
  const ov = el("div", { style: { position: "fixed", inset: "0", background: "rgba(0,0,0,.56)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "208", padding: "20px", animation: "fadeIn .2s ease" } });
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const card = el("div", { style: { width: "min(430px,100%)", maxHeight: "92vh", overflowY: "auto", position: "relative", background: th.card, border: "1px solid " + th.border, borderRadius: "22px", padding: "14px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" } });
  card.appendChild(el("button", { type: "button", title: "Close", style: { position: "absolute", top: "24px", right: "24px", zIndex: "2", width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card + "D9", color: th.sub, cursor: "pointer", fontSize: "20px", lineHeight: "1", boxShadow: "0 8px 18px rgba(0,0,0,.14)" }, onClick: () => close() }, "×"));
  card.appendChild(el("canvas", { id: "monthShareCanvas", width: "1080", height: "1080", style: { width: "100%", aspectRatio: "1 / 1", borderRadius: "18px", border: "1px solid " + th.border, background: "transparent", display: "block", boxShadow: "0 12px 34px rgba(0,0,0,.18)" } }));
  const actions = el("div", { style: { display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" } });
  const dl = el("button", { type: "button", style: { flex: "1", minWidth: "130px", padding: "11px", borderRadius: "10px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "800", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }, onClick: () => downloadShareCard() });
  dl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Download</span>';
  actions.appendChild(dl);
  actions.appendChild(el("button", { type: "button", style: { flex: "1", minWidth: "120px", padding: "11px", borderRadius: "10px", border: "1px solid " + th.border, background: "transparent", color: th.accent, fontSize: "12px", fontWeight: "800", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { void shareReport(); } }, "Share on X"));
  card.appendChild(actions);
  ov.appendChild(card);
  return ov;
}

function renderNav(th: Theme): HTMLElement {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: "home", label: "Home", icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { id: "insights", label: "Insights", icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    { id: "profile", label: "Profile", icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  ];
  const bar = el("div", { style: { position: "fixed", bottom: "14px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px", padding: "6px", background: th.card + "F0", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid " + th.border, borderRadius: "999px", boxShadow: "0 6px 18px rgba(0,0,0,.14), 0 0 14px " + th.accent + "1F", zIndex: "150" } });
  items.forEach((it) => {
    const active = state.tab === it.id;
    const btn = el("button", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", minWidth: "64px", padding: "8px 16px", borderRadius: "999px", border: "none", cursor: "pointer", background: active ? th.accent : "transparent", color: active ? "#FFFCF7" : th.sub, fontFamily: "'DM Sans',sans-serif", transition: "background .2s, color .2s" }, onClick: () => { setTab(it.id); window.scrollTo({ top: 0 }); render(); } });
    const ic = el("span", { style: { display: "flex" } });
    ic.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + "</svg>";
    btn.append(ic, el("span", { style: { fontSize: "10px", fontWeight: active ? "700" : "500" } }, it.label));
    bar.appendChild(btn);
  });
  return bar;
}

/** Insights view — all-time performance across every year. */
function renderInsights(th: Theme): HTMLElement {
  const wrap = el("div", { style: { padding: "8px 20px 0" } });
  wrap.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "22px", fontWeight: "700", margin: "8px 0 4px", color: th.text } }, "Insights"));
  wrap.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "0 0 16px" } }, "Your all-time performance across every year."));
  const all = state.wins;
  if (all.length === 0) {
    wrap.appendChild(el("div", { style: { textAlign: "center", padding: "48px 16px", color: th.muted, fontSize: "13px", background: th.card, border: "1px solid " + th.border, borderRadius: "14px" } }, "No winnings logged yet. Head to Home and log your first bag."));
    return wrap;
  }
  const total = all.reduce((s, w) => s + w.amount, 0);
  const byYear: Record<number, number> = {};
  all.forEach((w) => { byYear[w.year] = (byYear[w.year] || 0) + w.amount; });
  const years = Object.entries(byYear).map(([y, v]) => [Number(y), v] as [number, number]).sort((a, b) => b[0] - a[0]);
  const bestYear = years.reduce((b, [y, v]) => (v > b.v ? { y, v } : b), { y: 0, v: 0 });
  const byMonth: Record<string, number> = {};
  all.forEach((w) => { const k = w.month + " " + w.year; byMonth[k] = (byMonth[k] || 0) + w.amount; });
  const bestMonth = Object.entries(byMonth).reduce((b, [k, v]) => (v > b.v ? { k, v } : b), { k: "—", v: 0 });
  const bySrc: Record<string, number> = {};
  all.forEach((w) => { bySrc[w.source] = (bySrc[w.source] || 0) + w.amount; });
  const srcSorted = Object.entries(bySrc).sort((a, b) => b[1] - a[1]);
  const activeMonths = Object.keys(byMonth).length;
  const avg = activeMonths ? total / activeMonths : 0;

  const cards: { label: string; value: string; ac: string }[] = [
    { label: "Lifetime Earned", value: fmt(total), ac: th.accent },
    { label: "Total Deals", value: String(all.length), ac: th.sub },
    { label: "Best Year", value: bestYear.y ? bestYear.y + " (" + fmt(bestYear.v) + ")" : "—", ac: th.green },
    { label: "Best Month", value: bestMonth.v > 0 ? bestMonth.k + " (" + fmt(bestMonth.v) + ")" : "—", ac: state.dark ? "#DEB88A" : "#D4A574" },
    { label: "Top Source", value: srcSorted[0] ? srcSorted[0][0] : "—", ac: state.dark ? "#C0724D" : "#A0522D" },
    { label: "Avg / Active Month", value: fmt(avg), ac: th.sub },
  ];
  const grid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", marginBottom: "18px" } });
  cards.forEach((c) => {
    const card = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "12px", padding: "14px 16px", position: "relative", overflow: "hidden" } });
    card.appendChild(el("div", { style: { position: "absolute", top: "0", left: "0", width: "3px", height: "100%", background: c.ac, borderRadius: "12px 0 0 12px" } }));
    card.appendChild(el("div", { style: { fontSize: "10px", color: th.sub, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "5px" } }, c.label));
    card.appendChild(el("div", { style: { fontSize: "16px", fontWeight: "700", color: th.accent, wordBreak: "break-word" } }, c.value));
    grid.appendChild(card);
  });
  wrap.appendChild(grid);

  wrap.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "600", color: th.text, margin: "4px 0 10px" } }, "By Year"));
  const maxYear = Math.max(...years.map(([, v]) => v));
  const yc = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" } });
  years.forEach(([y, v]) => {
    const row = el("div", {});
    const top = el("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } });
    top.appendChild(el("span", { style: { fontSize: "12px", color: th.text, fontWeight: "600" } }, String(y)));
    top.appendChild(el("span", { style: { fontSize: "12px", color: th.sub, fontWeight: "600" } }, fmt(v)));
    row.appendChild(top);
    const bar = el("div", { style: { height: "8px", background: th.barBg, borderRadius: "4px", overflow: "hidden" } });
    bar.appendChild(el("div", { style: { width: (maxYear ? (v / maxYear) * 100 : 0) + "%", height: "100%", background: th.accentGrad, borderRadius: "4px", transition: "width .5s ease" } }));
    row.appendChild(bar);
    yc.appendChild(row);
  });
  wrap.appendChild(yc);
  return wrap;
}

/** Profile view — account, appearance, data, and about. */
function renderProfile(th: Theme): HTMLElement {
  const wrap = el("div", { style: { padding: "8px 20px 0" } });
  wrap.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "22px", fontWeight: "700", margin: "8px 0 16px", color: th.text } }, "Profile"));
  const card = (title: string) => {
    const c = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "14px", padding: "18px", marginBottom: "14px" } });
    c.appendChild(el("div", { style: { fontSize: "11px", color: th.sub, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" } }, title));
    return c;
  };
  const primaryBtn = (label: string, onClick: () => void) => el("button", { style: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick }, label);
  const outlineBtn = (label: string, onClick: () => void) => el("button", { style: { flex: "1", minWidth: "120px", padding: "11px", borderRadius: "10px", border: "1px solid " + th.border, background: "transparent", color: th.text, fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick }, label);

  // Account
  const acct = card("Account");
  if (state.user) {
    const row = el("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" } });
    const avatar = el("div", { style: { width: "44px", height: "44px", borderRadius: "50%", background: th.accent, color: "#FFFCF7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", flexShrink: "0", overflow: "hidden" } });
    if (state.profile.avatar) avatar.appendChild(el("img", { src: state.profile.avatar, alt: "Profile picture", style: { width: "100%", height: "100%", objectFit: "cover" } }));
    else avatar.textContent = ((state.profile.username || state.user.email || "?")[0] || "?").toUpperCase();
    row.appendChild(avatar);
    const info = el("div", { style: { minWidth: "0" } });
    const nameRow = el("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" } });
    nameRow.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "700", color: th.text, wordBreak: "break-word" } }, state.profile.username || "Set username"));
    const editProfile = el("button", { type: "button", title: "Edit profile", style: { width: "26px", height: "26px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }, onClick: () => { state.profileForm = { ...state.profile }; state.showProfileSetup = true; state.editingProfile = true; render(); } });
    editProfile.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
    nameRow.appendChild(editProfile);
    info.appendChild(nameRow);
    info.appendChild(el("div", { style: { fontSize: "12px", fontWeight: "500", color: th.sub, wordBreak: "break-all" } }, state.user.email || ""));
    info.appendChild(el("div", { style: { fontSize: "11px", color: th.green, marginTop: "2px" } }, "● Synced across devices"));
    row.appendChild(info);
    acct.appendChild(row);
    acct.appendChild(el("button", { style: { width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid " + th.border, background: "transparent", color: th.accent, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => signOut() }, "Sign out"));
  } else {
    acct.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "0 0 12px", lineHeight: "1.5" } }, cloudEnabled() ? "Sign in to sync your winnings across all your devices." : "Cloud sync isn't set up yet — Staxxs still works and saves everything locally."));
    acct.appendChild(primaryBtn("Sign in", () => { state.showAuth = true; state.authMode = "signin"; state.authError = ""; render(); }));
  }
  wrap.appendChild(acct);

  // Appearance
  const appear = card("Appearance");
  const themeRow = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } });
  themeRow.appendChild(el("span", { style: { fontSize: "13px", color: th.text } }, state.dark ? "Dark mode" : "Light mode"));
  themeRow.appendChild(el("button", { style: { padding: "8px 14px", borderRadius: "10px", border: "1px solid " + th.border, background: "transparent", color: th.accent, fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.dark = !state.dark; save(); render(); } }, state.dark ? "Switch to light" : "Switch to dark"));
  appear.appendChild(themeRow);
  wrap.appendChild(appear);

  // Data
  const data = card("Data");
  const dbtns = el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } });
  dbtns.appendChild(outlineBtn("Export CSV", () => { state.showCSVPanel = true; state.csvMode = "export"; state.csvText = ""; render(); }));
  dbtns.appendChild(outlineBtn("Import CSV", () => { state.showCSVPanel = true; state.csvMode = "import"; state.csvText = ""; render(); }));
  data.appendChild(dbtns);
  if (state.showCSVPanel) data.appendChild(renderCSVPanel(th, true));
  wrap.appendChild(data);

  // Reset progress
  const reset = card("Reset progress");
  reset.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "0 0 12px", lineHeight: "1.5" } }, "Clear one month or a full year. Your account, profile, and sources stay untouched."));
  const yearOptions = resetYearOptions();
  if (!yearOptions.includes(state.resetYear)) state.resetYear = yearOptions[0] || String(state.year);
  const periodOptions = [YEARLY_GOAL_LABEL, ...MONTHS];
  if (!periodOptions.includes(state.resetMonth)) state.resetMonth = MONTHS[new Date().getMonth()];
  const selectedYear = Number(state.resetYear);
  const resetWholeYear = state.resetMonth === YEARLY_GOAL_LABEL;
  const summary = resetSummary(selectedYear, resetWholeYear ? undefined : state.resetMonth);
  const periodText = resetWholeYear ? String(selectedYear) : state.resetMonth + " " + selectedYear;
  const resetGrid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "10px", marginBottom: "12px" } });
  resetGrid.append(
    mkSelect(state.resetYear, yearOptions, (v) => { state.resetYear = v; render(); }, "Year", th),
    el("div", {}, [
      el("label", { style: { fontSize: "11px", color: th.sub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block" } }, "Period"),
      mkDropdown(state.resetMonth, periodOptions, (v) => { state.resetMonth = v; render(); }, th, {
        labelFn: (value) => value === YEARLY_GOAL_LABEL ? "Full year" : MONTH_ABBREVIATIONS[MONTHS.indexOf(value)] || value,
      }),
    ]),
  );
  reset.appendChild(resetGrid);
  const resetSummaryText = summary.wins + " win" + (summary.wins === 1 ? "" : "s") + " · " + fmt(summary.total) + " · " + summary.goals + " goal" + (summary.goals === 1 ? "" : "s");
  reset.appendChild(el("div", { style: { border: "1px solid " + th.border, background: th.input, borderRadius: "10px", padding: "10px 12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" } }, [
    el("span", { style: { fontSize: "12px", color: th.text, fontWeight: "800" } }, periodText),
    el("span", { style: { fontSize: "12px", color: th.sub, fontWeight: "700" } }, resetSummaryText),
  ]));
  const disabledReset = summary.wins === 0 && summary.goals === 0;
  reset.appendChild(el("button", { disabled: disabledReset, style: { width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid " + th.danger, background: disabledReset ? "transparent" : th.danger + "18", color: disabledReset ? th.muted : th.danger, fontSize: "12px", fontWeight: "800", cursor: disabledReset ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: disabledReset ? ".55" : "1" }, onClick: () => { if (!disabledReset) confirmResetProgress(resetWholeYear ? "year" : "month"); } }, "Reset selected period"));
  wrap.appendChild(reset);

  // About
  const about = card("About");
  about.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "700", color: th.text, fontFamily: "'Playfair Display',serif" } }, "Staxxs"));
  about.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "4px 0 0", lineHeight: "1.5" } }, "Track your monthly wins, set earning goals, and watch your bags stack up."));
  about.appendChild(el("div", { style: { fontSize: "11px", color: th.muted, marginTop: "8px" } }, "v1.0.0"));
  wrap.appendChild(about);

  return wrap;
}

/** Generic confirmation popup for any destructive action (guards against mis-taps). */
function renderConfirm(th: Theme): HTMLElement {
  const c = state.confirm!;
  const close = () => { state.confirm = null; render(); };
  const ov = el("div", { style: { position: "fixed", inset: "0", background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "210", padding: "20px", animation: "fadeIn .2s ease" } });
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const card = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "340px", boxShadow: "0 12px 40px rgba(0,0,0,.25)" } });
  card.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "20px", margin: "0 0 6px", color: th.text } }, c.title));
  if (c.detail) card.appendChild(el("p", { style: { fontSize: "13px", color: th.text, margin: "0 0 4px", fontWeight: "600" } }, c.detail));
  if (c.message) card.appendChild(el("p", { style: { fontSize: "12px", color: th.muted, margin: "6px 0 0", lineHeight: "1.5" } }, c.message));
  const btns = el("div", { style: { display: "flex", gap: "8px", marginTop: "18px" } });
  btns.appendChild(el("button", { style: { flex: "1", padding: "11px", borderRadius: "10px", border: "none", background: th.danger, color: "#FFFCF7", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { const fn = c.onConfirm; state.confirm = null; fn(); } }, c.confirmLabel));
  btns.appendChild(el("button", { style: { flex: "1", padding: "11px", borderRadius: "10px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => close() }, "Cancel"));
  card.appendChild(btns);
  ov.appendChild(card);
  return ov;
}

function compressAvatar(file: File): Promise<string> {
  const maxInputBytes = 5 * 1024 * 1024;
  const maxSize = 512;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return Promise.reject(new Error("Choose a PNG, JPG, or WebP image"));
  }
  if (file.size > maxInputBytes) {
    return Promise.reject(new Error("Choose an image under 5 MB"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't load that image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Couldn't process that image")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

/** Build the profile setup / edit modal overlay. */
function renderProfileSetupModal(th: Theme): HTMLElement {
  const ov = el("div", { style: { position: "fixed", inset: "0", background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "205", padding: "20px", animation: "fadeIn .2s ease" } });
  const card = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "16px", padding: "26px", width: "100%", maxWidth: "360px", boxShadow: "0 12px 40px rgba(0,0,0,.25)" } });
  card.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "22px", margin: "0 0 4px", color: th.text } }, state.editingProfile ? "Edit profile" : "Set up profile"));
  card.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "0 0 18px", lineHeight: "1.5" } }, "Choose how your Staxxs profile looks across devices."));

  const avatarWrap = el("div", { style: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" } });
  const preview = el("div", { style: { width: "58px", height: "58px", borderRadius: "50%", background: th.accent, color: "#FFFCF7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700", overflow: "hidden", flexShrink: "0" } });
  if (state.profileForm.avatar) preview.appendChild(el("img", { src: state.profileForm.avatar, alt: "Profile picture preview", style: { width: "100%", height: "100%", objectFit: "cover" } }));
  else preview.textContent = ((state.profileForm.username || state.user?.email || "?")[0] || "?").toUpperCase();
  avatarWrap.appendChild(preview);
  const fileLabel = el("label", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 13px", borderRadius: "10px", border: "1px solid " + th.border, color: th.accent, fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" } }, "Change photo");
  const fileInput = el("input", { type: "file", accept: "image/*", style: { display: "none" } }) as HTMLInputElement;
  fileInput.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    compressAvatar(file)
      .then((avatar) => { state.profileForm.avatar = avatar; render(); })
      .catch((error: Error) => showToast(error.message));
  };
  fileLabel.appendChild(fileInput);
  avatarWrap.appendChild(fileLabel);
  if (state.profileForm.avatar) {
    avatarWrap.appendChild(el("button", { type: "button", style: { border: "none", background: "transparent", color: th.muted, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.profileForm.avatar = ""; render(); } }, "Remove"));
  }
  card.appendChild(avatarWrap);

  card.appendChild(mkInput(state.profileForm.username, "Your username", (v) => { state.profileForm.username = v; }, "Username", "text", th));
  const saveBtn = el("button", { style: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "14px" }, onClick: () => {
    const username = state.profileForm.username.trim();
    if (!username) { showToast("Add a username"); return; }
    state.profile = { username, avatar: state.profileForm.avatar };
    state.profileForm = { ...state.profile };
    state.showProfileSetup = false;
    state.editingProfile = false;
    save();
    render();
  } }, "Save profile");
  card.appendChild(saveBtn);
  if (state.editingProfile) {
    card.appendChild(el("button", { style: { width: "100%", padding: "8px", borderRadius: "8px", border: "none", background: "transparent", color: th.muted, fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "6px" }, onClick: () => { state.showProfileSetup = false; state.editingProfile = false; state.profileForm = { ...state.profile }; render(); } }, "Cancel"));
  }
  ov.appendChild(card);
  return ov;
}

function renderAuthModal(th: Theme): HTMLElement {
  const ov = el("div", { style: { position: "fixed", inset: "0", background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "200", padding: "20px", animation: "fadeIn .2s ease" } });
  ov.addEventListener("click", (e) => { if (e.target === ov) { state.showAuth = false; render(); } });
  const card = el("div", { style: { background: th.card, border: "1px solid " + th.border, borderRadius: "16px", padding: "26px", width: "100%", maxWidth: "360px", boxShadow: "0 12px 40px rgba(0,0,0,.25)", maxHeight: "90vh", overflowY: "auto" } });
  const signup = state.authMode === "signup";
  card.appendChild(el("h2", { style: { fontFamily: "'Playfair Display',serif", fontSize: "22px", margin: "0 0 4px", color: th.text } }, signup ? "Create account" : "Welcome back"));
  card.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "0 0 18px" } }, "Sync your bags across devices"));
  if (!cloudEnabled()) {
    card.appendChild(el("div", { style: { fontSize: "11px", color: th.danger, background: th.danger + "18", border: "1px solid " + th.danger, borderRadius: "8px", padding: "10px", marginBottom: "14px", lineHeight: "1.5" } }, "Cloud sync isn't set up yet. Add your Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — see the README."));
  }
  // Google
  const g = el("button", { disabled: state.authBusy, style: { width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid " + th.inputBorder, background: th.input, color: th.text, fontSize: "13px", fontWeight: "600", cursor: state.authBusy ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", marginBottom: "16px", opacity: state.authBusy ? "0.65" : "1" }, onClick: () => { if (!state.authBusy) signInGoogle(); } });
  g.innerHTML = '<svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg> Continue with Google';
  card.appendChild(g);
  // divider
  const dv = el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" } });
  dv.append(el("div", { style: { flex: "1", height: "1px", background: th.border } }), el("span", { style: { fontSize: "10px", color: th.muted, textTransform: "uppercase", letterSpacing: "0.5px" } }, "or"), el("div", { style: { flex: "1", height: "1px", background: th.border } }));
  card.appendChild(dv);
  // email + password
  card.appendChild(mkInput(state.authForm.email, "you@email.com", (v) => { state.authForm.email = v; }, "Email", "email", th));
  card.appendChild(el("div", { style: { height: "10px" } }));
  card.appendChild(mkInput(state.authForm.password, "••••••", (v) => { state.authForm.password = v; }, "Password", "password", th));
  if (state.authError) card.appendChild(el("div", { style: { fontSize: "11px", color: th.danger, marginTop: "10px", lineHeight: "1.4" } }, state.authError));
  card.appendChild(el("button", { disabled: state.authBusy, style: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "13px", fontWeight: "700", cursor: state.authBusy ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "14px", opacity: state.authBusy ? "0.6" : "1" }, onClick: () => { if (state.authBusy) return; signup ? signUpEmail() : signInEmail(); } }, state.authBusy ? "Please wait..." : signup ? "Create account" : "Sign in"));
  card.appendChild(el("button", { style: { width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "transparent", color: th.sub, fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "6px" }, onClick: () => { state.authMode = signup ? "signin" : "signup"; state.authError = ""; render(); } }, signup ? "Already have an account? Sign in" : "New here? Create an account"));
  card.appendChild(el("button", { style: { width: "100%", padding: "6px", borderRadius: "8px", border: "none", background: "transparent", color: th.muted, fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "2px" }, onClick: () => { state.showAuth = false; render(); } }, "Cancel"));
  ov.appendChild(card);
  return ov;
}
