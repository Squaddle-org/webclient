import { h, mount } from "./dom";
import { parseRoute, routeToPath, type Route } from "./router";
import { IdentityStore } from "./identity/identity-store";
import { IndexedDbKeystore } from "./storage/keystore";
import { getRelayHost } from "./storage/relay-host-pref";
import { RoomSessionOrchestrator, type LiveUpdatesSubscription } from "./relay/room-session";
import { setMyUserKey } from "./session-context";
import { renderOnboarding } from "./screens/onboarding";
import { renderRoomsList } from "./screens/rooms-list";
import { renderRoomView } from "./screens/room";
import { renderIdeaDetail } from "./screens/idea-detail";
import { renderJoin } from "./screens/join";
import { renderSettings } from "./screens/settings";

const identityStore = new IdentityStore(new IndexedDbKeystore());
let orchestrator: RoomSessionOrchestrator | null = null;
let liveSub: LiveUpdatesSubscription | null = null;

/** Opens (or reuses) the one session for this page load - mirrors `RoomSessionOrchestrator`'s
 * own doc comment: constructed once, not per-call, so pulled data/cursors persist for the
 * lifetime of the page. */
async function ensureSession(): Promise<RoomSessionOrchestrator> {
  if (orchestrator) return orchestrator;
  const identity = await identityStore.load();
  if (!identity) throw new Error("no identity - onboarding must run first");
  setMyUserKey(new Int8Array(identity.deviceCertUser.buffer as ArrayBuffer, identity.deviceCertUser.byteOffset, identity.deviceCertUser.byteLength));
  orchestrator = await RoomSessionOrchestrator.open(identity, getRelayHost());
  await orchestrator.registerDevice(); // self-certifying, always safe to call again (SyncClient.publishDeviceCert's own doc comment)
  return orchestrator;
}

/** Settings' relay-host change calls this - forces a fresh session against the new host on the
 * next `ensureSession()`, same as the old relay-host field (now moved into Settings) used to. */
function resetSession(): void {
  orchestrator = null;
}

export function navigate(route: Route): void {
  history.pushState(null, "", routeToPath(route));
  render();
}

function currentRoute(): Route {
  return parseRoute(location.pathname, location.href);
}

export async function render(): Promise<void> {
  const container = document.getElementById("app");
  if (!container) return;

  // Whatever the previous screen subscribed to (only the room view does), it's no longer the
  // active screen - stop both the WebSocket and the local poll driving it.
  liveSub?.close();
  liveSub = null;

  if (!(await identityStore.hasIdentity())) {
    mount(container, renderOnboarding(identityStore, () => void render()));
    return;
  }

  const route = currentRoute();
  try {
    if (route.kind === "join") {
      await renderJoin(container, route.url, ensureSession, navigate);
      return;
    }
    const session = await ensureSession();
    switch (route.kind) {
      case "onboarding":
      case "rooms":
        mount(container, await renderRoomsList(session, navigate));
        break;
      case "room":
        mount(container, await renderRoomView(session, route.roomIdB32, navigate, (sub) => { liveSub = sub; }));
        break;
      case "idea":
        mount(container, await renderIdeaDetail(session, route.roomIdB32, route.ideaIdB32, navigate));
        break;
      case "settings":
        mount(container, await renderSettings(session, identityStore, resetSession, navigate));
        break;
    }
  } catch (err) {
    mount(container, h("div", { class: "error" }, [`Something went wrong: ${err instanceof Error ? err.message : String(err)}`]));
  }
}
