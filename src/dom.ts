/**
 * Tiny `createElement` wrapper - no framework (ADR-0009). All children go through
 * `appendChild`/`createTextNode`, never `innerHTML` interpolation, so idea titles/descs/comments
 * (arbitrary text from other room members, never trusted) can't inject markup - the same
 * baseline XSS hygiene a framework would give for free, without pulling one in.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | ((ev: Event) => void)> = {},
  children: (Node | string | null)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") {
      el.addEventListener(key.replace(/^on/, "").toLowerCase(), value);
    } else if (key === "class") {
      el.className = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child === null) continue;
    el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(container: HTMLElement): void {
  container.replaceChildren();
}

export function mount(container: HTMLElement, ...nodes: (Node | null)[]): void {
  clear(container);
  for (const node of nodes) if (node !== null) container.append(node);
}
