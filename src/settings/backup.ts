import { BackupApi, BackupRoomRefJs, EncodingApi } from "core";
import type { IdentityRecord } from "../identity/identity-record";
import type { KnownRoom } from "../rooms/known-rooms-store";

/**
 * Settings screen's backup/restore flow - the web-appropriate equivalent of android's Storage
 * Access Framework backup (no SAF in a browser): a plain file download for backup, a file input
 * for restore. Both go through `core`'s `BackupApi` (PROTOCOL.md §7, the same codec android's
 * `BackupCodec.kt` uses with the same Argon2 params) via a plain blob + anchor-download/file-input
 * round trip, so a backup created by one client restores on the other.
 */

export interface RestoredBackup {
  entropy: Int8Array;
  rooms: { roomId: Int8Array; relayHost: string; name: string | null }[];
  createdAt: number;
}

/** Triggers a browser download of a `.squaddle-backup` file encrypted with [passphrase]. */
export async function createBackupFile(identity: IdentityRecord, knownRooms: KnownRoom[], passphrase: string): Promise<void> {
  const entropy = new Int8Array(identity.entropy.buffer as ArrayBuffer, identity.entropy.byteOffset, identity.entropy.byteLength);
  const rooms = knownRooms.map((r) => new BackupRoomRefJs(r.roomId, r.relayHost, r.displayName));
  const bytes = await BackupApi.getInstance().create(entropy, rooms, Date.now(), passphrase);

  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "squaddle-backup.squaddle-backup";
  a.click();
  URL.revokeObjectURL(url);
}

/** `null` on a wrong passphrase or a malformed file - never throws (same as `Backup.restore`
 * itself). */
export async function restoreBackupFile(file: File, passphrase: string): Promise<RestoredBackup | null> {
  const bytes = new Int8Array(await file.arrayBuffer());
  const content = await BackupApi.getInstance().restore(passphrase, bytes);
  if (!content) return null;
  return {
    entropy: content.entropy,
    rooms: content.rooms.map((r) => ({ roomId: r.roomId, relayHost: r.relayHost, name: r.name ?? null })),
    createdAt: content.createdAt,
  };
}

export function roomIdToB32(roomId: Int8Array): string {
  return EncodingApi.getInstance().base32Encode(roomId);
}
