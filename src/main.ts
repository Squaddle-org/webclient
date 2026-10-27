import { StorageApi } from "core";
// `?url` - Vite's asset-import convention: resolves to a build-stable URL for the file itself
// (copied into the build output), rather than trying to parse/bundle `.wasm` as JS.
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { render } from "./app";
import { setRelayHost } from "./storage/relay-host-pref";

async function bootstrap(): Promise<void> {
  await StorageApi.getInstance().preloadSqlJsDriver((file) => (file.endsWith(".wasm") ? sqlWasmUrl : file));

  // `?relay=<host>` overrides the stored preference once, at startup - without this, the Rooms
  // screen's own relay-host field can't help: `render()` establishes a session (and calls
  // registerDevice) against whatever host is already configured *before* that screen (or any
  // screen past onboarding) ever renders, so there's no way to redirect a fresh identity to a
  // non-default relay purely through in-app navigation. Exists for e2e/create-invite-join-vote.spec.ts
  // (a local test relay) as much as for a real self-hoster bookmarking a deep link.
  const relayOverride = new URL(location.href).searchParams.get("relay");
  if (relayOverride) setRelayHost(relayOverride);

  window.addEventListener("popstate", () => render());
  document.body.addEventListener("click", (ev) => {
    const anchor = (ev.target as HTMLElement).closest("a");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/")) return; // external links navigate normally
    ev.preventDefault();
    history.pushState(null, "", href);
    render();
  });

  await render();
}

void bootstrap();
