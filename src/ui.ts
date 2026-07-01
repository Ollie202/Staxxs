import { el } from "./dom";
import type { Theme } from "./theme";

interface DropdownOpts {
  compact?: boolean;
  /** Map an option value to its display label (value stays the raw option). */
  labelFn?: (o: string) => string;
}

/**
 * Custom, fully theme-able dropdown that replaces the native <select> popup
 * (which the OS renders and CSS can't style). Opens/closes locally without a
 * full re-render; selecting an option calls onChange.
 */
export function mkDropdown(
  value: string,
  options: string[],
  onChange: (v: string) => void,
  th: Theme,
  opts: DropdownOpts = {},
): HTMLElement {
  const { compact = false, labelFn } = opts;
  const label = (o: string) => (labelFn ? labelFn(o) : o);

  const root = el("div", { style: { position: "relative", width: compact ? "auto" : "100%" } });

  const trigger = el("button", { type: "button", style: { width: compact ? "auto" : "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: compact ? "6px 10px" : "10px 12px", borderRadius: "10px", border: "1px solid " + th.inputBorder, background: th.input, color: compact ? th.sub : th.text, fontSize: compact ? "11px" : "14px", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", outline: "none", boxSizing: "border-box", transition: "border-color .15s, box-shadow .15s" } });
  const valueSpan = el("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label(value));
  const chev = el("span", { style: { display: "flex", flexShrink: "0", transition: "transform .2s" } });
  chev.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + th.sub + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  trigger.append(valueSpan, chev);

  const panel = el("div", { style: { position: "absolute", top: "calc(100% + 6px)", left: "0", minWidth: "100%", width: compact ? "max-content" : "100%", background: th.card, border: "1px solid " + th.border, borderRadius: "12px", padding: "6px", zIndex: "90", boxShadow: "0 12px 32px rgba(0,0,0,.18)", maxHeight: "260px", overflowY: "auto", display: "none", animation: "fadeIn .12s ease" } });

  options.forEach((o) => {
    const selected = o === value;
    const item = el("div", { style: { padding: "9px 12px", borderRadius: "8px", cursor: "pointer", fontSize: compact ? "12px" : "14px", color: selected ? "#FFFCF7" : th.text, background: selected ? th.accent : "transparent", fontWeight: selected ? "600" : "400", whiteSpace: "nowrap", transition: "background .12s" } }, label(o));
    item.addEventListener("mouseenter", () => { if (!selected) item.style.background = th.toggleBg; });
    item.addEventListener("mouseleave", () => { if (!selected) item.style.background = "transparent"; });
    item.addEventListener("click", (e) => { e.stopPropagation(); valueSpan.textContent = label(o); close(); onChange(o); });
    panel.appendChild(item);
  });

  let open = false;
  let outside: ((e: MouseEvent) => void) | null = null;

  function close(): void {
    if (!open) return;
    open = false;
    panel.style.display = "none";
    chev.style.transform = "rotate(0deg)";
    trigger.style.borderColor = th.inputBorder;
    trigger.style.boxShadow = "none";
    if (outside) { document.removeEventListener("mousedown", outside); outside = null; }
  }
  function openPanel(): void {
    if (open) return;
    open = true;
    panel.style.display = "block";
    chev.style.transform = "rotate(180deg)";
    trigger.style.borderColor = th.accent;
    trigger.style.boxShadow = "0 0 0 3px " + th.accent + "22";
    outside = (e: MouseEvent) => { if (!root.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", outside);
  }
  trigger.addEventListener("click", (e) => { e.stopPropagation(); open ? close() : openPanel(); });
  trigger.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") close(); });

  root.append(trigger, panel);
  return root;
}

/** Labeled dropdown (custom, themed) bound to an onChange callback. */
export function mkSelect(
  value: string,
  options: string[],
  onChange: (v: string) => void,
  label: string,
  th: Theme,
): HTMLElement {
  const wrap = el("div", {});
  wrap.appendChild(el("label", { style: { fontSize: "11px", color: th.sub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block" } }, label));
  wrap.appendChild(mkDropdown(value, options, onChange, th));
  return wrap;
}

/** Labeled <input> bound to an onChange callback. */
export function mkInput(
  value: string,
  placeholder: string,
  onChange: (v: string) => void,
  label: string,
  type: string,
  th: Theme,
): HTMLElement {
  const wrap = el("div", {});
  wrap.appendChild(el("label", { style: { fontSize: "11px", color: th.sub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block" } }, label));
  const inp = el("input", { type: type || "text", placeholder, style: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, fontSize: "16px", color: th.text, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" } }) as HTMLInputElement;
  if (type === "number") inp.step = "0.01";
  inp.value = value;
  inp.oninput = (e) => onChange((e.target as HTMLInputElement).value);
  wrap.appendChild(inp);
  return wrap;
}

/** Small rounded filter pill. */
export function mkPill(
  text: string,
  active: boolean,
  onClick: () => void,
  th: Theme,
): HTMLElement {
  return el("button", { style: { padding: "4px 10px", borderRadius: "14px", border: "1px solid " + (active ? th.accent : th.border), background: active ? th.accent : "transparent", color: active ? "#FFFCF7" : th.sub, fontSize: "10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: active ? "600" : "400" }, onClick }, text);
}
