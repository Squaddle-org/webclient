import { EncodingApi } from "core";
import type { Event } from "../relay/room-session";

/**
 * Ports android's `ui/room/CalendarExport.kt` `buildIcs` byte-for-byte (same UID scheme, same
 * field mapping, same CRLF line endings per RFC 5545) - the web-appropriate equivalent of
 * `CalendarContract` (no device calendar integration exists in a browser): the browser's own
 * "open with" handling on a downloaded `.ics` file does the rest.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC `yyyyMMdd` / `yyyyMMdd'T'HHmmss'Z'`, matching `icsDateFormat`/`icsDateTimeFormat`. */
function icsDate(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function icsDateTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${icsDate(epochSeconds)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

/** [event]'s `start`/`end` are Unix seconds (see {@link Event}'s own doc comment). */
export function buildIcs(event: Pick<Event, "id" | "title" | "start" | "end" | "allDay" | "location">): string {
  const uid = `${EncodingApi.getInstance().base32Encode(event.id)}@squaddle`;
  const endSeconds = event.end ?? (event.allDay ? event.start + 86_400 : event.start);
  const dtStart = event.allDay ? `DTSTART;VALUE=DATE:${icsDate(event.start)}` : `DTSTART:${icsDateTime(event.start)}`;
  const dtEnd = event.allDay ? `DTEND;VALUE=DATE:${icsDate(endSeconds)}` : `DTEND:${icsDateTime(endSeconds)}`;

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Squaddle//Squaddle//EN", "BEGIN:VEVENT", `UID:${uid}`, dtStart, dtEnd, `SUMMARY:${icsEscape(event.title)}`];
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  lines.push(`DTSTAMP:${icsDateTime(Math.floor(Date.now() / 1000))}`, "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Triggers a browser download of [event] as a `.ics` file - the one DOM-download idiom this
 * module needs (same pattern settings/backup.ts reuses for backup files). */
export function downloadIcs(event: Pick<Event, "id" | "title" | "start" | "end" | "allDay" | "location">): void {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${EncodingApi.getInstance().base32Encode(event.id)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
