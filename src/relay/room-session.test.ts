import { describe, expect, it } from "vitest";
import { IdentityApi, StorageApi } from "core";
import { IDBFactory } from "fake-indexeddb";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { RoomSessionOrchestrator } from "./room-session";
import type { IdentityRecord } from "../identity/identity-record";

const RELAY_HOST = "localhost:18080";

function toUint8Array(bytes: Int8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
}

async function freshIdentity(deviceLabel: string): Promise<IdentityRecord> {
  const result = await IdentityApi.getInstance().create(deviceLabel);
  return {
    entropy: toUint8Array(result.entropy),
    devicePublicKey: toUint8Array(result.devicePublicKey),
    deviceSecretKey: toUint8Array(result.deviceSecretKey),
    deviceCertUser: toUint8Array(result.deviceCertUser),
    deviceCertUserBox: toUint8Array(result.deviceCertUserBox),
    deviceCertLabel: result.deviceCertLabel,
    deviceCertIssuedAt: result.deviceCertIssuedAt,
    deviceCertSig: toUint8Array(result.deviceCertSig),
  };
}

describe("RoomSessionOrchestrator against a real local relay", () => {
  it("create room -> invite -> join -> both see the room, named via the invite envelope", async () => {
    const wasmDir = join(dirname(fileURLToPath(import.meta.url)), "../../node_modules/sql.js/dist");
    await StorageApi.getInstance().preloadSqlJsDriver((f: string) => join(wasmDir, f));

    // Alice and Bob are separate browser profiles - separate IndexedDB instances, since
    // KnownRoomsStore's local bookkeeping isn't keyed by identity (one seed per origin, per
    // webclient/CLAUDE.md).
    (globalThis as any).indexedDB = new IDBFactory();
    const alice = await RoomSessionOrchestrator.open(await freshIdentity("Alice's Phone"), RELAY_HOST, false);
    expect(await alice.registerDevice()).toBe(true);

    const roomId = await alice.createRoom("Weekend Trip");
    expect(roomId).not.toBeNull();

    const invite = await alice.createInvite(roomId!, false, null, null);
    expect(invite).not.toBeNull();
    expect(invite!.link.inviteSecret).not.toBeNull();

    const aliceRooms = await alice.listKnownRooms();
    expect(aliceRooms).toHaveLength(1);
    expect(aliceRooms[0]!.displayName).toBe("Weekend Trip");

    (globalThis as any).indexedDB = new IDBFactory();
    const bob = await RoomSessionOrchestrator.open(await freshIdentity("Bob's Phone"), RELAY_HOST, false);
    expect(await bob.registerDevice()).toBe(true);

    const joined = await bob.joinViaUrl(invite!.url);
    expect(joined).not.toBeNull();
    expect(joined!.roomId).toEqual(roomId);

    // Bob never set a display name himself - it came from Alice's invite envelope.
    const bobRooms = await bob.listKnownRooms();
    expect(bobRooms).toHaveLength(1);
    expect(bobRooms[0]!.displayName).toBe("Weekend Trip");

    const bobRefreshed = await bob.refreshKnownRooms();
    expect(bobRefreshed[0]!.displayName).toBe("Weekend Trip");
  });

  it("joinViaUrl returns null for an unparseable link, without touching the relay", async () => {
    (globalThis as any).indexedDB = new IDBFactory();
    const dave = await RoomSessionOrchestrator.open(await freshIdentity("Dave's Phone"), RELAY_HOST, false);
    expect(await dave.joinViaUrl("not a link")).toBeNull();
    expect(await dave.listKnownRooms()).toHaveLength(0);
  });
});
