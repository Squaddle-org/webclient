import { h } from "../dom";

/**
 * Ports android's `ui/components/EmptyStateIllustration.kt` `StickyNoteIllustration` exactly:
 * two tilted rounded-rect "sticky notes" (tertiaryContainer behind, secondaryContainer in front,
 * same 62%-of-140dp size, same -10/+8 degree tilt, same 20-unit corner radius) fanned behind a
 * centered icon tinted with the primary color - the one illustration every empty state in the
 * app reuses, so an empty rooms/ideas/events/members list reads as the same family on both
 * clients instead of a blank area.
 */
const SIZE = 140;
const NOTE = SIZE * 0.62;
const NOTE_OFFSET = (SIZE - NOTE) / 2;

/** Minimal inline-SVG stand-ins for the three M3 icons android varies per empty state
 * (lightbulb/calendar/people) - same silhouette, not a pixel-exact icon font port, since there's
 * no bundled icon font here (CLAUDE.md: no third-party fonts/scripts). */
const ICONS: Record<"idea" | "event" | "people", string> = {
  idea: '<path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm-2 18a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1h-4Z"/>',
  event:
    '<path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2Zm14 8H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z"/>',
  people:
    '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3 0-8 1.5-8 4.5V20h16v-1.5c0-3-5-4.5-8-4.5Z"/>',
};

export function renderEmptyState(icon: "idea" | "event" | "people", message: string): HTMLElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("width", String(SIZE));
  svg.setAttribute("height", String(SIZE));
  svg.innerHTML = `
    <g transform="rotate(-10 ${SIZE / 2} ${SIZE / 2})">
      <rect x="${NOTE_OFFSET}" y="${NOTE_OFFSET}" width="${NOTE}" height="${NOTE}" rx="20" fill="var(--color-tertiary-container)" />
    </g>
    <g transform="rotate(8 ${SIZE / 2} ${SIZE / 2})">
      <rect x="${NOTE_OFFSET}" y="${NOTE_OFFSET}" width="${NOTE}" height="${NOTE}" rx="20" fill="var(--color-secondary-container)" />
    </g>
    <g transform="translate(${SIZE / 2 - 22} ${SIZE / 2 - 22})" fill="var(--color-primary)">${ICONS[icon]}</g>
  `;
  return h("div", { class: "empty-state", style: "display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 0;text-align:center;" }, [
    svg,
    h("p", { class: "body-medium", style: "color:var(--color-on-surface-variant);margin:0;" }, [message]),
  ]);
}
