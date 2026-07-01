/** Generate a short unique-ish id. */
export const gid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Escape a string for safe use inside a RegExp. */
export const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Format a number as USD currency. */
export const fmt = (n: number): string =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const $ = (s: string): HTMLElement | null => document.querySelector(s);
export const $$ = (s: string): NodeListOf<Element> => document.querySelectorAll(s);

type Attrs = Record<string, unknown>;
type Child = Node | string | null | undefined;
type Children = Child | Child[];

/**
 * Tiny hyperscript-style element builder.
 * - `style` may be an object of CSS properties.
 * - keys starting with `on` register event listeners (e.g. `onClick`).
 * - `innerHTML` sets raw HTML; other keys become attributes.
 */
export function el(tag: string, attrs?: Attrs, children?: Children): HTMLElement {
  const e = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "style" && typeof v === "object" && v !== null) {
        Object.assign(e.style, v as Record<string, string>);
      } else if (k.startsWith("on")) {
        e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === "innerHTML") {
        e.innerHTML = v as string;
      } else {
        e.setAttribute(k, v as string);
      }
    });
  }
  if (children !== undefined) {
    if (Array.isArray(children)) {
      children.forEach((c) => {
        if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    } else if (typeof children === "string") {
      e.textContent = children;
    } else if (children instanceof Node) {
      e.appendChild(children);
    }
  }
  return e;
}
