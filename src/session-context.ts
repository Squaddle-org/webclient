/**
 * The current device's own user key (= `IdentityRecord.deviceCertUser` - every `DeviceCert`
 * carries its owner's real per-user key, per PROTOCOL.md §2.1/§2.2), set once per page load by
 * `app.ts`'s `ensureSession` and read by screens that need to compare a member/idea/event's
 * author against "is this me" (member-action gating, idea edit/delete ownership) - a tiny module
 * of its own purely to avoid screens importing back into `app.ts` (which imports them).
 */
let myUserKey: Int8Array | null = null;

export function setMyUserKey(key: Int8Array): void {
  myUserKey = key;
}

/** Throws if called before `ensureSession` has run - every screen that needs this is only ever
 * rendered after `app.ts`'s `render()` has already called `ensureSession`. */
export function getMyUserKey(): Int8Array {
  if (!myUserKey) throw new Error("no active session yet");
  return myUserKey;
}
