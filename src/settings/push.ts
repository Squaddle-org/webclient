import type { RoomSessionOrchestrator } from "../relay/room-session";

/**
 * Web Push - the browser equivalent of android's UnifiedPush registration
 * (`push_install_ntfy_hint`'s own role, minus the distributor-app concept browsers don't have).
 * Same relay endpoints either way (`GET /push/vapid`, `POST`/`DELETE /push` - see
 * `RelaySession.vapidPublicKey`/`registerPushEndpoint`/`unregisterPush`), and the same
 * content-free push contract (ADR-0013/PROTOCOL.md §6: a push carries no room content, ever) -
 * `public/sw.js` only ever shows a generic "something changed" notification and leaves the real
 * sync to the app itself once opened.
 */

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** `false` if push isn't configured on this relay, the browser denies permission, or
 * registration otherwise fails - never throws. */
export async function enablePush(session: RoomSessionOrchestrator): Promise<boolean> {
  if (!pushSupported()) return false;
  const vapidKey = await session.vapidPublicKey();
  if (!vapidKey) return false;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidKey),
    });
    return session.registerPushEndpoint(subscription.endpoint);
  } catch {
    return false;
  }
}

export async function disablePush(session: RoomSessionOrchestrator): Promise<boolean> {
  if (!pushSupported()) return true;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Best-effort unsubscribe on the browser side - unregisterPush below still runs either way.
  }
  return session.unregisterPush();
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription != null;
}
