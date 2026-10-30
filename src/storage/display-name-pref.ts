const STORAGE_KEY = "squaddle-display-name";

/** Plain `localStorage` - a chosen display name isn't sensitive (same reasoning as
 * `relay-host-pref.ts`), and it's sent to every room's members anyway (`setProfile`). */
export function getDisplayName(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim();
  if (trimmed === "") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, trimmed);
}
