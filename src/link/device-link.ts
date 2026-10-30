import { LinkApi, BackupRoomRefJs, type LinkQrJs, type GeneratedLinkJs, type LinkedIdentityJs } from "core";
import type { KnownRoom } from "../rooms/known-rooms-store";

/**
 * PROTOCOL.md §2.3 device linking - thin TS layer over `core`'s `LinkApi` (same split every other
 * feature module here uses: `backup.ts` over `BackupApi`, `push.ts` over the push endpoints on
 * `RelaySession`). `LinkQrJs`/`GeneratedLinkJs`/`LinkedIdentityJs` are used directly rather than
 * converted to yet another plain-object shape - `sealAndSendIdentity` needs the exact `LinkQrJs`
 * instance back anyway, so round-tripping it through a plain object would only lose information.
 */

export type { LinkQrJs, GeneratedLinkJs, LinkedIdentityJs };

/** New device (N), step 1 - mints the ephemeral keypair + code and builds the QR string to
 * display. [relayHost] is whatever this instance is configured to use (same preference as every
 * other session - `storage/relay-host-pref.ts`). */
export async function generateLink(relayHost: string): Promise<GeneratedLinkJs> {
  return LinkApi.getInstance().generate(relayHost);
}

/** Existing device (E), scanning a QR shown by a new device - `null` if the decoded string isn't
 * a `squaddle-link:v1:...` URI. */
export function parseLinkQr(uri: string): LinkQrJs | null {
  return LinkApi.getInstance().parseQr(uri) ?? null;
}

/** Existing device (E), step 2 - seals this device's own entropy + known rooms to [qr]'s
 * ephemeral public key and posts it to the relay mailbox. `false` if the POST itself failed
 * (network error, relay down) - never throws. */
export async function sealAndSendIdentity(qr: LinkQrJs, entropy: Int8Array, knownRooms: KnownRoom[], tls = true): Promise<boolean> {
  const rooms = knownRooms.map((r) => new BackupRoomRefJs(r.roomId, r.relayHost, r.displayName));
  const sealed = await LinkApi.getInstance().sealForLink(qr, entropy, rooms);
  return LinkApi.getInstance().postMailbox(qr.relayHost, qr.code, sealed, tls);
}

/** New device (N), step 3 - one mailbox GET. `null` on a 404/not-there-yet (keep polling) or on
 * a successful GET whose body doesn't open under [ephemeralSecretKey] (shouldn't happen for a
 * code this device itself generated, but never throws either way). The caller owns the polling
 * loop/cadence (same reasoning as `LinkApi.pollMailbox`'s own doc comment). */
export async function pollForLinkedIdentity(qr: LinkQrJs, ephemeralSecretKey: Int8Array, tls = true): Promise<LinkedIdentityJs | null> {
  const sealed = await LinkApi.getInstance().pollMailbox(qr.relayHost, qr.code, tls);
  if (!sealed) return null;
  return (await LinkApi.getInstance().openLinkedIdentity(qr.ephemeralPublicKey, ephemeralSecretKey, sealed)) ?? null;
}

/** Step 4, both sides - the 6-digit code the user compares between devices. */
export async function confirmationCode(ephemeralPublicKey: Int8Array, userKey: Int8Array): Promise<string> {
  return LinkApi.getInstance().confirmationCode(ephemeralPublicKey, userKey);
}
