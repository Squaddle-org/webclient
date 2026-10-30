/**
 * A minimal path-based router - no framework (ADR-0009: "thin TS/vanilla UI"). Routes are plain
 * data, not configuration objects with callbacks, so route-matching stays pure and
 * unit-testable without a DOM (see router.test.ts) - `main.ts` is the only thing that actually
 * touches `location`/`history`.
 *
 * Deliberately NOT hash-based: website's `/j/*` "Open in browser" button (per website/CLAUDE.md
 * and the §3.5 invite link shape) builds a real path - `/j/<relayHost>/<roomId>/<inviteId>` -
 * with the invite secret as the URL's own fragment, and that's the one and only fragment slot a
 * URL has. A hash-router would collide with that fragment the moment it tried to also encode
 * app-internal routes there. Real paths need nginx's SPA fallback (`try_files $uri /index.html`,
 * `deployments/webclient`/the Dockerfile's `nginx.conf` - a later task) to work on a hard
 * reload/direct link; that's a deploy-time concern, not this module's.
 */
export type Route =
  | { kind: "onboarding" }
  | { kind: "rooms" }
  | { kind: "room"; roomIdB32: string }
  | { kind: "idea"; roomIdB32: string; ideaIdB32: string }
  | { kind: "settings" }
  /** [url] is the full URL (path + fragment) - handed to `parseInviteLink` as-is, so the secret
   * never gets re-encoded or round-tripped through anything else first. */
  | { kind: "join"; url: string };

/** [pathname] is `location.pathname` (no origin, no fragment); [href] is the full
 * `location.href` (incl. fragment) - only read at all for the `join` route, and passed through
 * verbatim. Unparseable/unknown shapes fall back to `rooms` (the app's home screen). */
export function parseRoute(pathname: string, href: string): Route {
  if (pathname.startsWith("/j/")) return { kind: "join", url: href };

  const trimmed = pathname.replace(/^\/+/, "");
  if (trimmed === "" || trimmed === "onboarding") return { kind: "onboarding" };
  if (trimmed === "rooms") return { kind: "rooms" };
  if (trimmed === "settings") return { kind: "settings" };

  const roomMatch = /^rooms\/([^/]+)$/.exec(trimmed);
  if (roomMatch) return { kind: "room", roomIdB32: roomMatch[1]! };

  const ideaMatch = /^rooms\/([^/]+)\/ideas\/([^/]+)$/.exec(trimmed);
  if (ideaMatch) return { kind: "idea", roomIdB32: ideaMatch[1]!, ideaIdB32: ideaMatch[2]! };

  return { kind: "rooms" };
}

/** `join` has no app-internal path of its own - once handled, navigation moves on to the room
 * it resolved to, so there's nothing meaningful to link back to. */
export function routeToPath(route: Route): string {
  switch (route.kind) {
    case "onboarding":
      return "/onboarding";
    case "rooms":
      return "/rooms";
    case "room":
      return `/rooms/${route.roomIdB32}`;
    case "idea":
      return `/rooms/${route.roomIdB32}/ideas/${route.ideaIdB32}`;
    case "settings":
      return "/settings";
    case "join":
      return "/rooms";
  }
}
