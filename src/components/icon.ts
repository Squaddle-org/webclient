const SVG_NS = "http://www.w3.org/2000/svg";

/** Material Symbols glyphs, 24x24 viewBox - hardcoded path data (never user-supplied), built via
 * createElementNS rather than innerHTML (dom.ts's own no-innerHTML rule). Add more paths here as
 * icon usage grows; keep this the single source so every screen draws the same glyph set. */
const PATHS = {
  "chevron-up": "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z",
  "chevron-down": "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z",
  "group": "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
} satisfies Record<string, string>;

export function icon(name: keyof typeof PATHS): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", PATHS[name]);
  svg.appendChild(path);
  return svg;
}
