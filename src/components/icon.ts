const SVG_NS = "http://www.w3.org/2000/svg";

/** Material Symbols glyphs, 24x24 viewBox - hardcoded path data (never user-supplied), built via
 * createElementNS rather than innerHTML (dom.ts's own no-innerHTML rule). Add more paths here as
 * icon usage grows; keep this the single source so every screen draws the same glyph set. */
const PATHS = {
  "chevron-up": "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z",
  "chevron-down": "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z",
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
