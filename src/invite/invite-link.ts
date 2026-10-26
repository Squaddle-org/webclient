import { EncodingApi } from "core";

/** PROTOCOL.md §3.5 / spec/ARCHITECTURE.md §Links:
 * `https://<linkHost>/j/<relayHost>/<b32 roomId>/<b32 inviteId>#<b64url inviteSecret>`.
 * `inviteSecret` is `null` for an approval-required invite (§3.5 - no envelope exists for those,
 * so there's no secret to carry). Mirrors android's `InviteLink` exactly, including the base32
 * choice for `roomId`/`inviteId` - this must stay byte-for-byte interoperable with links android
 * (or anything else) generates, not just self-consistent.
 *
 * Fields are `Int8Array`, not `Uint8Array` - that's how Kotlin's `ByteArray` crosses the
 * `@JsExport` boundary (confirmed against the generated `core.d.mts`), and these values feed
 * straight into `RelaySession`'s own `ByteArray`-typed parameters without conversion. */
export interface InviteLink {
  relayHost: string;
  roomId: Int8Array;
  inviteId: Int8Array;
  inviteSecret: Int8Array | null;
}

const SHAPE = /^https:\/\/[^/]+\/j\/([^/]+)\/([^/]+)\/([^/]+)$/;

function base64UrlEncode(bytes: Int8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte & 0xff);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): Int8Array<ArrayBuffer> | null {
  try {
    const std = text.replaceAll("-", "+").replaceAll("_", "/");
    const padded = std.length % 4 === 0 ? std : std + "=".repeat(4 - (std.length % 4));
    const binary = atob(padded);
    const bytes = new Int8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** `null` on anything that doesn't parse or decode cleanly - never throws. [text]'s fragment,
 * when present, is an invite secret and is never logged by any caller of this (CLAUDE.md). */
export function parseInviteLink(text: string): InviteLink | null {
  const hashIndex = text.indexOf("#");
  const withoutFragment = hashIndex >= 0 ? text.slice(0, hashIndex) : text;
  const fragment = hashIndex >= 0 ? text.slice(hashIndex + 1) : null;

  const match = SHAPE.exec(withoutFragment);
  if (!match) return null;
  const [, relayHost, roomIdB32, inviteIdB32] = match;

  const roomId = EncodingApi.getInstance().base32Decode(roomIdB32!);
  const inviteId = EncodingApi.getInstance().base32Decode(inviteIdB32!);
  if (!roomId || !inviteId) return null;

  const inviteSecret = !fragment ? null : base64UrlDecode(fragment);
  if (fragment && !inviteSecret) return null;

  return { relayHost: relayHost!, roomId, inviteId, inviteSecret };
}

export function inviteLinkToString(link: InviteLink, linkHost = "squaddle.org"): string {
  const base = `https://${linkHost}/j/${link.relayHost}/${EncodingApi.getInstance().base32Encode(link.roomId)}/${EncodingApi.getInstance().base32Encode(link.inviteId)}`;
  return link.inviteSecret ? `${base}#${base64UrlEncode(link.inviteSecret)}` : base;
}
