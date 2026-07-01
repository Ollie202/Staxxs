import { el } from "./dom";
import type { Theme } from "./theme";

/** Labeled <select> bound to an onChange callback. */
export function mkSelect(
  value: string,
  options: string[],
  onChange: (v: string) => void,
  label: string,
  th: Theme,
): HTMLElement {
  const wrap = el("div", {});
  wrap.appendChild(el("label", { style: { fontSize: "11px", color: th.sub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block" } }, label));
  const sel = el("select", { style: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid " + th.inputBorder, background: th.input, fontSize: "16px", color: th.text, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" } }) as HTMLSelectElement;
  options.forEach((o) => {
    const opt = el("option", { value: o }, o) as HTMLOptionElement;
    if (o === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = (e) => onChange((e.target as HTMLSelectElement).value);
  wrap.appendChild(sel);
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
