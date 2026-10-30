import { h } from "../dom";

/**
 * Ports android's `ui/components/Avatar.kt` algorithm byte-for-byte (same hash, same HSL
 * saturation/lightness, same initials rule, same 3x2-mirrored dot-grid geometric mark) so the
 * same user key renders as the same-looking avatar on both clients - no network round-trip, no
 * key material leaves the device.
 */

/** Kotlin's `fold(0) { acc, b -> acc * 31 + b.toInt() }` on a signed-byte array, replicated with
 * explicit `| 0` truncation so this wraps the same way Kotlin's 32-bit `Int` silently does.
 * [userKey] is `Int8Array` (signed bytes) - same as `RelaySession`'s own `ByteArray` params. */
function javaStyleHash(userKey: Int8Array): number {
  let hash = 0;
  for (const b of userKey) hash = (hash * 31 + b) | 0;
  return hash;
}

function avatarColor(userKey: Int8Array): { hue: number; css: string } {
  const hash = javaStyleHash(userKey);
  const hue = Math.abs(hash) % 360;
  return { hue, css: `hsl(${hue}, 55%, 62%)` };
}

/** Relative (WCAG) luminance of an HSL color at saturation 0.55 / lightness 0.62, used the same
 * way android's `Color.luminance() > 0.5f` picks the on-color - computed via HSL->sRGB->linear
 * rather than hard-coding a lookup, since [hue] varies continuously. */
function hslLuminance(hue: number, saturation: number, lightness: number): number {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const linearize = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linearize(r + m) + 0.7152 * linearize(g + m) + 0.0722 * linearize(b + m);
}

function initialsOf(displayName: string | null): string | null {
  const name = (displayName ?? "").trim();
  if (!name) return null;
  const parts = name.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return parts[0]!.slice(0, 1).toUpperCase();
}

/** Same bit-accumulation as `GeometricMark`'s `bits` (shl 1, xor low bit of each byte), read back
 * as a 3-row x 2-col grid mirrored left/right - a deterministic "this is a real, specific person"
 * mark for a member with no display name yet. */
function geometricMarkSvg(userKey: Int8Array, tint: string, pixelSize: number): SVGSVGElement {
  let bits = 0;
  for (const b of userKey) bits = (bits << 1) ^ (b & 1);
  const cell = pixelSize / 3;
  const circles: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const bitIndex = row * 2 + col;
      if (((bits >> bitIndex) & 1) === 0) continue;
      const cx = (col + 0.5) * cell;
      const cy = (row + 0.5) * cell;
      const r = cell * 0.32;
      circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${tint}" />`);
      circles.push(`<circle cx="${pixelSize - cx}" cy="${cy}" r="${r}" fill="${tint}" />`);
    }
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${pixelSize} ${pixelSize}`);
  svg.setAttribute("width", String(pixelSize));
  svg.setAttribute("height", String(pixelSize));
  svg.innerHTML = circles.join("");
  return svg;
}

/** [sizePx] matches android's own default (40dp) unless the caller needs a smaller/larger one
 * (member list rows vs. a profile header, say). */
export function renderAvatar(userKey: Int8Array, displayName: string | null, sizePx = 40): HTMLElement {
  const { hue, css } = avatarColor(userKey);
  const onColor = hslLuminance(hue, 0.55, 0.62) > 0.5 ? "#201A17" : "#FFFFFF";
  const initials = initialsOf(displayName);
  const content: Node[] = initials
    ? [document.createTextNode(initials)]
    : [geometricMarkSvg(userKey, onColor, Math.round(sizePx * 0.5))];
  const el = h("div", {
    class: "avatar",
    style: `width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${css};color:${onColor};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(sizePx * 0.35)}px;flex:none;`,
  });
  for (const node of content) el.appendChild(node);
  return el;
}
