import { DEFAULT_RELAY_HOST } from "../relay/room-session";

const STORAGE_KEY = "squaddle-relay-host";

/** Plain `localStorage` is fine here - unlike the seed, a relay hostname isn't sensitive
 * (webclient/CLAUDE.md's "never localStorage" rule is scoped to the seed itself). */
export function getRelayHost(): string {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_RELAY_HOST;
}

export function setRelayHost(host: string): void {
  if (host.trim() === "" || host.trim() === DEFAULT_RELAY_HOST) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, host.trim());
  }
}
