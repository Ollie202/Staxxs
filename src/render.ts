import { state, save, showToast, gk, yw, doAddSource } from "./state";
import { LIGHT, DARK, type Theme } from "./theme";
import type { Tab } from "./types";
import { MONTHS, CHART_TYPES } from "./constants";
import { el, fmt, gid, $ } from "./dom";
import { mkSelect, mkInput, mkPill, mkDropdown } from "./ui";
import { renderChart } from "./chart";
import { exportCSV, downloadCSV, importCSV } from "./csv";
import { signInGoogle, signInEmail, signUpEmail, signOut } from "./auth";
import { cloudEnabled } from "./supabaseClient";

// Logo lives in public/ so it's copied to the deploy root; BASE_URL keeps the
// path correct on both the Vercel root and the GitHub Pages /Staxx/ subpath.
const LOGO_URL = import.meta.env.BASE_URL + "favicon-192.png";

export function render(): void {
  const th: Theme = state.dark ? DARK : LIGHT;
  const wins = yw();
  const totalEarned = wins.reduce((s, w) => s + w.amount, 0);
  const dm = state.activeMonth || MONTHS[new Date().getMonth()];
  const cGoal = state.goals[gk(dm, state.year)];
  const cEarned = wins.filter((w) => w.month === dm).reduce((s, w) => s + w.amount, 0);
  const gPct = cGoal ? Math.min((cEarned / cGoal) * 100, 100) : 0;
  const exceeded = cGoal && cEarned > cGoal;
  let bestM = { m: "—", t: 0 };
  MONTHS.forEach((m) => { const v = wins.filter((w) => w.month === m).reduce((s, w) => s + w.amount, 0); if (v > bestM.t) bestM = { m, t: v }; });
  const bestMonth = bestM.t > 0 ? bestM.m + " (" + fmt(bestM.t) + ")" : "—";
  const srcMap: Record<string, number> = {};
  wins.forEach((w) => { srcMap[w.source] = (srcMap[w.source] || 0) + w.amount; });
  let topSrc = { n: "—", t: 0 };
  Object.entries(srcMap).forEach(([n, v]) => { if (v > topSrc.t) topSrc = { n, t: v }; });
  const topSource = topSrc.t > 0 ? topSrc.n : "—";

  const resetTargetMonth = state.winMonth || dm;
  const displayWins = (state.winMonth ? wins.filter((w) => w.month === state.winMonth) : wins).sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const displayTotal = displayWins.reduce((s, w) => s + w.amount, 0);
  const srcPool = state.sourceView === "monthly" ? wins.filter((w) => w.month === state.sourceMonth) : wins;
  const srcTotal = srcPool.reduce((s, w) => s + w.amount, 0);
  const srcBreakMap: Record<string, number> = {};
  srcPool.forEach((w) => { srcBreakMap[w.source] = (srcBreakMap[w.source] || 0) + w.amount; });
  const srcBreak = Object.entries(srcBreakMap).sort((a, b) => b[1] - a[1]);

  const app = $("#app")!;
  app.innerHTML = "";
  app.style.cssText = "min-height:100vh;transition:background .3s,color .3s;overflow-x:hidden;";
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
  const brand = el("div", { style: { display: "flex", alignItems: "center", gap: "11px" } });
  brand.appendChild(el("img", { src: LOGO_URL, alt: "Staxx logo", width: "30", height: "30", style: { width: "30px", height: "30px", borderRadius: "8px", flexShrink: "0", boxShadow: "0 1px 4px rgba(0,0,0,.12)" } }));
  brand.appendChild(el("h1", { style: { fontFamily: "'Playfair Display',serif", fontSize: "26px", fontWeight: "700", margin: "0", color: th.text, letterSpacing: "-0.5px", lineHeight: "1" } }, "Staxx"));
  hdrL.appendChild(brand);
  hdrL.appendChild(el("p", { style: { margin: "8px 0 0", fontSize: "12px", color: th.sub, lineHeight: "1.4" } }, "Track your monthly wins, set earning goals, and watch your bags stack up."));
  const hdrR = el("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" } });

  const csvBtn = el("button", { style: { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.showCSVPanel = !state.showCSVPanel; state.csvMode = "export"; state.csvText = ""; render(); } });
  csvBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

  const thBtn = el("button", { style: { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.dark = !state.dark; save(); render(); } });
  thBtn.innerHTML = state.dark ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  const yrL = el("button", { style: { width: "32px", height: "32px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", fontSize: "14px", color: th.sub, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.year--; render(); } }, "←");
  const yrR = el("button", { style: { width: "32px", height: "32px", borderRadius: "50%", border: "1px solid " + th.border, background: th.card, cursor: "pointer", fontSize: "14px", color: th.sub, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { state.year++; render(); } }, "→");
  const yrSpan = el("span", { style: { fontFamily: "'Playfair Display',serif", fontSize: "20px", fontWeight: "600", color: th.text, minWidth: "48px", textAlign: "center" } }, String(state.year));

  // Auth / account button
  const authWrap = el("div", { style: { position: "relative" } });
  const authBtn = el("button", { style: { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + th.border, background: state.user ? th.accent : th.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFCF7", fontSize: "14px", fontWeight: "700", fontFamily: "'DM Sans',sans-serif" }, title: state.user ? state.user.email : "Sign in to sync", onClick: () => { if (state.user) { state.showAccount = !state.showAccount; } else { state.showAuth = true; state.authError = ""; } render(); } });
  if (state.user) { authBtn.textContent = ((state.user.email || "?")[0] || "?").toUpperCase(); }
  else authBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  authWrap.appendChild(authBtn);
  if (state.user && state.showAccount) {
    const menu = el("div", { style: { position: "absolute", top: "42px", right: "0", background: th.card, border: "1px solid " + th.border, borderRadius: "10px", padding: "12px", minWidth: "190px", zIndex: "60", boxShadow: "0 8px 24px rgba(0,0,0,.18)", animation: "fadeIn .15s ease" } });
    menu.appendChild(el("div", { style: { fontSize: "10px", color: th.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" } }, "Signed in as"));
    menu.appendChild(el("div", { style: { fontSize: "12px", color: th.text, fontWeight: "600", marginBottom: "10px", wordBreak: "break-all" } }, state.user.email || ""));
    menu.appendChild(el("button", { style: { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.accent, fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => signOut() }, "Sign out"));
    authWrap.appendChild(menu);
  }

  hdrR.append(authWrap, csvBtn, thBtn, yrL, yrSpan, yrR);
  hdr.append(hdrL, hdrR);
  app.appendChild(hdr);

  // CSV Panel
  if (state.showCSVPanel) {
    const cp = el("div", { style: { margin: "16px 20px 0", background: th.card, border: "1px solid " + th.border, borderRadius: "14px", padding: "18px", animation: "fadeIn .2s ease" } });
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

      const ta = el("textarea", { style: { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, color: th.text, fontSize: "11px", fontFamily: "monospace", minHeight: "120px", resize: "vertical", outline: "none", boxSizing: "border-box" }, placeholder: "Year,Month,Project,Amount,Source\n2026,Jan,MyProject,100,Bounties" }) as HTMLTextAreaElement;
      ta.value = state.csvText;
      ta.oninput = (e) => { state.csvText = (e.target as HTMLTextAreaElement).value; };
      cp.appendChild(ta);
      const btns = el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } });
      btns.appendChild(el("button", { style: { flex: "1", padding: "11px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => importCSV() }, "Import Data"));
      btns.appendChild(el("button", { style: { padding: "11px 16px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.showCSVPanel = false; state.csvText = ""; render(); } }, "Close"));
      cp.appendChild(btns);
    }
    app.appendChild(cp);
  }

  if (state.tab === "home") {
  // Goal Card
  const gc = el("div", { style: { margin: "20px 20px 0", background: th.card, border: "1px solid " + th.border, borderRadius: "14px", padding: "18px" } });
  const gcTop = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" } });
  const gcL = el("div", {});
  gcL.appendChild(el("div", { style: { fontSize: "13px", fontWeight: "600", color: th.text } }, dm + " Goal"));
  if (cGoal) {
    const sub = el("div", { style: { fontSize: "12px", color: th.sub, marginTop: "2px" } });
    sub.textContent = fmt(cEarned) + " of " + fmt(cGoal);
    if (exceeded) { const sp = el("span", { style: { color: th.green, fontWeight: "600" } }, " — Exceeded!"); sub.appendChild(sp); }
    gcL.appendChild(sub);
  } else gcL.appendChild(el("div", { style: { fontSize: "12px", color: th.muted, marginTop: "2px" } }, "No goal set"));

  const gcR = el("div", { style: { display: "flex", gap: "6px" } });
  if (cGoal) gcR.appendChild(el("button", { style: { padding: "5px 10px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", cursor: "pointer", fontSize: "11px", color: th.accent, fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.confirm = { title: "Remove this goal?", detail: dm + " " + state.year + " goal — " + fmt(cGoal), message: "Your logged winnings stay; only the goal is removed.", confirmLabel: "Remove", onConfirm: () => { const g = { ...state.goals }; delete g[gk(dm, state.year)]; state.goals = g; save(); render(); } }; render(); } }, "Remove"));
  gcR.appendChild(el("button", { style: { padding: "5px 12px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, cursor: "pointer", fontSize: "11px", color: th.sub, fontFamily: "'DM Sans',sans-serif", fontWeight: "500" }, onClick: () => { state.goalForm = { month: dm, target: cGoal ? String(cGoal) : "" }; state.editingGoalKey = cGoal ? gk(dm, state.year) : null; state.showGoalForm = !state.showGoalForm; render(); } }, cGoal ? "Edit" : "Set Goal"));
  gcTop.append(gcL, gcR);
  gc.appendChild(gcTop);

  // Progress bar
  const bar = el("div", { style: { width: "100%", height: "24px", background: th.barBg, borderRadius: "12px", overflow: "hidden", position: "relative" } });
  const fill = el("div", { style: { width: cGoal ? gPct + "%" : "0%", height: "100%", background: exceeded ? th.greenGrad : th.accentGrad, borderRadius: "12px", transition: "width .8s cubic-bezier(.4,0,.2,1)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: gPct > 15 ? "10px" : "0" } });
  if (cGoal && gPct > 15) fill.appendChild(el("span", { style: { fontSize: "11px", fontWeight: "700", color: "#FFFCF7", textShadow: "0 1px 2px rgba(0,0,0,.2)" } }, Math.round(gPct) + "%"));
  bar.appendChild(fill);
  if (cGoal && gPct <= 15) bar.appendChild(el("span", { style: { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", fontWeight: "600", color: th.sub } }, Math.round(gPct) + "%"));
  gc.appendChild(bar);

  // Mini month bars
  const miniRow = el("div", { style: { display: "flex", gap: "3px", marginTop: "12px", flexWrap: "wrap" } });
  MONTHS.forEach((m) => {
    const g = state.goals[gk(m, state.year)];
    const e = wins.filter((w) => w.month === m).reduce((s, w) => s + w.amount, 0);
    const p = g ? Math.min((e / g) * 100, 100) : 0;
    const hit = g && e >= g;
    const isA = m === dm;
    const d = el("div", { style: { flex: "1 1 0", minWidth: "24px", cursor: "pointer", textAlign: "center" }, onClick: () => { state.activeMonth = isA && state.activeMonth === m ? null : m; render(); } });
    d.appendChild(el("div", { style: { fontSize: "8px", color: isA ? th.text : th.muted, fontWeight: isA ? "600" : "400", marginBottom: "2px" } }, m));
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
    const mSel = mkSelect(state.goalForm.month, MONTHS, (v) => { state.goalForm.month = v; }, "Month", th);
    const tInp = mkInput(state.goalForm.target, "500", (v) => { state.goalForm.target = v; }, "Target ($)", "number", th);
    row.append(mSel, tInp);
    gf.appendChild(row);
    const btns = el("div", { style: { display: "flex", gap: "8px" } });
    btns.appendChild(el("button", { style: { flex: "1", padding: "10px", borderRadius: "8px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { const v = parseFloat(state.goalForm.target); if (isNaN(v) || v <= 0) return; state.goals[state.editingGoalKey || gk(state.goalForm.month, state.year)] = v; state.showGoalForm = false; state.editingGoalKey = null; save(); render(); } }, state.editingGoalKey ? "Update" : "Set Goal"));
    btns.appendChild(el("button", { style: { padding: "10px 14px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", color: th.sub, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.showGoalForm = false; render(); } }, "Cancel"));
    gf.appendChild(btns);
    gc.appendChild(gf);
  }
  app.appendChild(gc);

  // Stats
  const stats: { label: string; value: string | number; ac: string }[] = [
    { label: "Total Earned", value: fmt(totalEarned), ac: th.accent },
    { label: "Total Deals", value: wins.length, ac: th.sub },
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
  const canvas = el("canvas", { id: "mainChart", style: { width: "100%", maxHeight: isPie ? "360px" : "300px" } });
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
  if (state.winMonth) wCol.appendChild(el("div", { style: { fontSize: "12px", color: th.sub, marginBottom: "8px" }, innerHTML: state.winMonth + " Total: <span style='font-weight:700;color:" + th.text + "'>" + fmt(displayTotal) + "</span>" }));

  if (displayWins.length === 0) {
    wCol.appendChild(el("div", { style: { textAlign: "center", padding: "36px 16px", color: th.muted, fontSize: "13px", background: th.card, border: "1px solid " + th.border, borderRadius: "12px" }, innerHTML: (state.winMonth ? "Nothing for " + state.winMonth + " yet" : "No bags for " + state.year + " yet") + "<br><span style='font-size:11px;margin-top:4px;display:inline-block'>Log your first win above</span>" }));
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
      tag.appendChild(el("button", { style: { width: "16px", height: "16px", borderRadius: "4px", border: "none", background: "transparent", cursor: "pointer", fontSize: "10px", color: th.muted, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => { if (state.sources.length <= 1) { showToast("Need at least one source"); return; } const used = state.wins.filter((w) => w.source === s).length; state.confirm = { title: 'Remove "' + s + '"?', message: used > 0 ? used + " winning" + (used === 1 ? "" : "s") + " using this source will be moved to another source." : "No winnings use this source.", confirmLabel: "Remove", onConfirm: () => { const fb = state.sources.find((x) => x !== s) || "Other"; state.sources = state.sources.filter((x) => x !== s); state.wins = state.wins.map((w) => w.source === s ? { ...w, source: fb } : w); save(); render(); showToast('Removed "' + s + '"'); } }; render(); } }, "×"));
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

  // Reset buttons
  const resetRow = el("div", { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", padding: "0 20px 28px" } });
  const rd = el("div", { style: { display: "flex", gap: "8px" } });
  const mkReset = (label: string, type: "month" | "year") => {
    const wrap = el("div", { style: { position: "relative" }, class: "reset-btn" });
    const tip = el("div", { class: "reset-tooltip", style: { background: th.card, border: "1px solid " + th.border, color: th.sub } }, type === "month" ? "Reset wins for " + resetTargetMonth : "Reset wins for " + state.year);
    wrap.appendChild(tip);
    const btn = el("button", { style: { display: "flex", alignItems: "center", gap: "3px", padding: "4px 8px", borderRadius: "8px", border: "1px solid " + th.border, background: "transparent", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => { state.confirm = { title: type === "month" ? "Reset all wins for " + resetTargetMonth + " " + state.year + "?" : "Reset all wins for " + state.year + "?", message: "This deletes those winnings and their goals. This can't be undone.", confirmLabel: "Reset", onConfirm: () => { if (type === "month") { state.wins = state.wins.filter((w) => !(w.year === state.year && w.month === resetTargetMonth)); delete state.goals[gk(resetTargetMonth, state.year)]; } else { state.wins = state.wins.filter((w) => w.year !== state.year); MONTHS.forEach((m) => { delete state.goals[gk(m, state.year)]; }); } save(); render(); } }; render(); } });
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + th.muted + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span style="font-size:10px;font-weight:600;color:' + th.muted + '">' + label + "</span>";
    wrap.appendChild(btn);
    return wrap;
  };
  rd.append(mkReset("M", "month"), mkReset("Y", "year"));
  resetRow.appendChild(rd);
  app.appendChild(resetRow);

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

  // Confirmation popup for any destructive action (delete / remove / reset)
  if (state.confirm) app.appendChild(renderConfirm(th));

  // Render chart
  renderChart(th, wins);
}

/** Floating liquid-glass navigation bar (bottom, same on mobile + desktop). */
function renderNav(th: Theme): HTMLElement {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: "home", label: "Home", icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { id: "insights", label: "Insights", icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    { id: "profile", label: "Profile", icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  ];
  const bar = el("div", { style: { position: "fixed", bottom: "8px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px", padding: "6px", background: th.card + "CC", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid " + th.border + "AA", borderRadius: "999px", boxShadow: "0 10px 32px rgba(0,0,0,.28)", zIndex: "150" } });
  items.forEach((it) => {
    const active = state.tab === it.id;
    const btn = el("button", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", minWidth: "64px", padding: "8px 16px", borderRadius: "999px", border: "none", cursor: "pointer", background: active ? th.accent : "transparent", color: active ? "#FFFCF7" : th.sub, fontFamily: "'DM Sans',sans-serif", transition: "background .2s, color .2s" }, onClick: () => { state.tab = it.id; state.showCSVPanel = false; window.scrollTo({ top: 0 }); render(); } });
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
    row.appendChild(el("div", { style: { width: "40px", height: "40px", borderRadius: "50%", background: th.accent, color: "#FFFCF7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", flexShrink: "0" } }, ((state.user.email || "?")[0] || "?").toUpperCase()));
    const info = el("div", { style: { minWidth: "0" } });
    info.appendChild(el("div", { style: { fontSize: "13px", fontWeight: "600", color: th.text, wordBreak: "break-all" } }, state.user.email || ""));
    info.appendChild(el("div", { style: { fontSize: "11px", color: th.green, marginTop: "2px" } }, "● Synced across devices"));
    row.appendChild(info);
    acct.appendChild(row);
    acct.appendChild(el("button", { style: { width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid " + th.border, background: "transparent", color: th.accent, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }, onClick: () => signOut() }, "Sign out"));
  } else {
    acct.appendChild(el("p", { style: { fontSize: "12px", color: th.sub, margin: "0 0 12px", lineHeight: "1.5" } }, cloudEnabled() ? "Sign in to sync your winnings across all your devices." : "Cloud sync isn't set up yet — Staxx still works and saves everything locally."));
    acct.appendChild(primaryBtn("Sign in", () => { state.showAuth = true; state.authError = ""; render(); }));
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
  const dbtns = el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } });
  dbtns.appendChild(outlineBtn("Export CSV", () => { state.tab = "home"; state.showCSVPanel = true; state.csvMode = "export"; state.csvText = ""; render(); }));
  dbtns.appendChild(outlineBtn("Import CSV", () => { state.tab = "home"; state.showCSVPanel = true; state.csvMode = "import"; state.csvText = ""; render(); }));
  data.appendChild(dbtns);
  wrap.appendChild(data);

  // About
  const about = card("About");
  about.appendChild(el("div", { style: { fontSize: "14px", fontWeight: "700", color: th.text, fontFamily: "'Playfair Display',serif" } }, "Staxx"));
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

/** Build the sign-in / sign-up modal overlay. */
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
  const g = el("button", { style: { width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid " + th.inputBorder, background: th.input, color: th.text, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", marginBottom: "16px" }, onClick: () => signInGoogle() });
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
  card.appendChild(el("button", { style: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: th.accent, color: "#FFFCF7", fontSize: "13px", fontWeight: "700", cursor: state.authBusy ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "14px", opacity: state.authBusy ? "0.6" : "1" }, onClick: () => { if (state.authBusy) return; signup ? signUpEmail() : signInEmail(); } }, state.authBusy ? "Please wait…" : signup ? "Create account" : "Sign in"));
  card.appendChild(el("button", { style: { width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "transparent", color: th.sub, fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "6px" }, onClick: () => { state.authMode = signup ? "signin" : "signup"; state.authError = ""; render(); } }, signup ? "Already have an account? Sign in" : "New here? Create an account"));
  card.appendChild(el("button", { style: { width: "100%", padding: "6px", borderRadius: "8px", border: "none", background: "transparent", color: th.muted, fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: "2px" }, onClick: () => { state.showAuth = false; render(); } }, "Cancel"));
  ov.appendChild(card);
  return ov;
}
