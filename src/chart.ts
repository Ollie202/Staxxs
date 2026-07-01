import Chart from "chart.js/auto";
import { MONTHS } from "./constants";
import { fmt } from "./dom";
import type { Theme } from "./theme";
import type { Win } from "./types";
import { state } from "./state";

let chart: Chart | null = null;

/** (Re)draw the main earnings chart based on the current chart type. */
export function renderChart(th: Theme, wins: Win[]): void {
  const ctx = document.getElementById("mainChart") as HTMLCanvasElement | null;
  if (!ctx) return;
  if (chart) {
    chart.destroy();
    chart = null;
  }
  const data = MONTHS.map((m) =>
    parseFloat(wins.filter((w) => w.month === m).reduce((s, w) => s + w.amount, 0).toFixed(2)),
  );
  const type = state.chartType.toLowerCase();

  if (type === "pie") {
    const srcMap: Record<string, number> = {};
    wins.forEach((w) => { srcMap[w.source] = (srcMap[w.source] || 0) + w.amount; });
    const labels = Object.keys(srcMap);
    const vals = Object.values(srcMap);
    const PIE_COLORS = ["#C4956A", "#4A90D9", "#6B8E5A", "#D45B5B", "#8B5CF6", "#E6A23C", "#2DD4BF", "#EC4899", "#F97316", "#64748B", "#A0522D", "#06B6D4"];
    const colors = labels.map((_l, i) => PIE_COLORS[i % PIE_COLORS.length]);
    if (labels.length === 0) { labels.push("No Data"); vals.push(1); colors.push(th.barBg); }
    chart = new Chart(ctx, {
      type: "doughnut",
      data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderColor: th.card, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 30, bottom: 10, left: 10, right: 10 } }, plugins: { legend: { display: true, position: "bottom", labels: { color: th.sub, font: { family: "'DM Sans',sans-serif", size: 10 }, usePointStyle: true, pointStyle: "circle", padding: 14 } }, tooltip: { callbacks: { label: function (i: any) { const t = i.dataset.data.reduce((a: number, b: number) => a + b, 0); const p = Math.round(i.parsed / t * 100); return i.label + ": " + fmt(i.parsed) + " (" + p + "%)"; } } } } },
      plugins: [{ id: "pieLabels", afterDraw: function (c: any) { const ctx2 = c.ctx; const meta = c.getDatasetMeta(0); if (!meta || !meta.data) return; ctx2.save(); ctx2.font = "10px 'DM Sans',sans-serif"; ctx2.textBaseline = "middle"; meta.data.forEach(function (arc: any, i: number) { if (i >= labels.length) return; const model = arc.tooltipPosition(); const cx = c.width / 2; const cy = c.height / 2; const angle = ((arc.startAngle + arc.endAngle) / 2); const radius = arc.outerRadius + 16; const x2 = cx + Math.cos(angle) * radius; const y2 = cy + Math.sin(angle) * radius; const x3 = x2 + (x2 > cx ? 12 : -12); ctx2.beginPath(); ctx2.moveTo(model.x, model.y); ctx2.lineTo(x2, y2); ctx2.lineTo(x3, y2); ctx2.strokeStyle = th.sub; ctx2.lineWidth = 1; ctx2.stroke(); ctx2.fillStyle = th.text; ctx2.textAlign = x2 > cx ? "left" : "right"; ctx2.fillText(labels[i], x3 + (x2 > cx ? 4 : -4), y2); }); ctx2.restore(); } }],
    } as any);
    return;
  }
  if (type === "radar") {
    chart = new Chart(ctx, {
      type: "radar",
      data: { labels: MONTHS, datasets: [{ label: "Earnings", data, backgroundColor: th.accent + "30", borderColor: th.accent, borderWidth: 2, pointBackgroundColor: th.accent }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: th.border }, angleLines: { color: th.border }, ticks: { display: false }, pointLabels: { color: th.sub, font: { family: "'DM Sans',sans-serif", size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i: any) => fmt(i.parsed.r) } } } },
    } as any);
    return;
  }
  const chartType = type === "area" ? "line" : "bar";
  chart = new Chart(ctx, {
    type: chartType as "line" | "bar",
    data: { labels: MONTHS, datasets: [{ label: "Earnings", data, backgroundColor: type === "area" ? th.accent + "20" : th.accent, borderColor: th.accent, borderWidth: type === "line" || type === "area" ? 2.5 : 0, borderRadius: type === "bar" ? 6 : 0, fill: type === "area", tension: 0.3, pointBackgroundColor: th.accent, pointBorderColor: th.card, pointBorderWidth: 2, pointRadius: type === "line" || type === "area" ? 3 : 0 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { color: th.sub, font: { family: "'DM Sans',sans-serif", size: 11 } }, border: { color: th.border } }, y: { grid: { color: th.border + "80", drawBorder: false }, ticks: { color: th.sub, font: { family: "'DM Sans',sans-serif", size: 11 }, callback: (v: any) => "$" + v }, border: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i: any) => fmt(i.parsed.y) } } } },
  } as any);
}
