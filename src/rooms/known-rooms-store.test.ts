import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { KnownRoomsStore } from "./known-rooms-store";

describe("KnownRoomsStore", () => {
  beforeEach(() => {
    // Fresh database per test - the global fake-indexeddb/auto instance persists across tests
    // otherwise, since this store always opens the same fixed DB_NAME.
    (globalThis as any).indexedDB = new IDBFactory();
  });

  const roomA = new Int8Array(32).map((_, i) => i);
  const roomB = new Int8Array(32).map((_, i) => i + 100);

  it("round-trips a stored room through upsert/all", async () => {
    const store = new KnownRoomsStore();
    await store.upsert({
      roomId: roomA,
      displayName: "Weekend Plans",
      relayHost: "relay.squaddle.org",
      joinedAt: 1000,
      lastActivityAt: 1000,
    });

    const rooms = await store.all();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.roomId).toEqual(roomA);
    expect(rooms[0]!.displayName).toBe("Weekend Plans");
    expect(rooms[0]!.relayHost).toBe("relay.squaddle.org");
  });

  it("sorts by most-recently-active first", async () => {
    const store = new KnownRoomsStore();
    await store.upsert({ roomId: roomA, displayName: "Older", relayHost: "r", joinedAt: 1, lastActivityAt: 1 });
    await store.upsert({ roomId: roomB, displayName: "Newer", relayHost: "r", joinedAt: 2, lastActivityAt: 500 });

    const rooms = await store.all();
    expect(rooms.map((r) => r.displayName)).toEqual(["Newer", "Older"]);
  });

  it("upsert on an existing roomId overwrites rather than duplicating", async () => {
    const store = new KnownRoomsStore();
    await store.upsert({ roomId: roomA, displayName: "First Name", relayHost: "r", joinedAt: 1, lastActivityAt: 1 });
    await store.upsert({ roomId: roomA, displayName: "Renamed", relayHost: "r", joinedAt: 1, lastActivityAt: 1 });

    const rooms = await store.all();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.displayName).toBe("Renamed");
  });

  it("touchActivity updates lastActivityAt without touching other fields", async () => {
    const store = new KnownRoomsStore();
    await store.upsert({ roomId: roomA, displayName: "Room", relayHost: "r", joinedAt: 1, lastActivityAt: 1 });
    await store.touchActivity(roomA, 9999);

    const rooms = await store.all();
    expect(rooms[0]!.lastActivityAt).toBe(9999);
    expect(rooms[0]!.displayName).toBe("Room");
  });

  it("touchActivity on an unknown roomId is a no-op, not an error", async () => {
    const store = new KnownRoomsStore();
    await expect(store.touchActivity(roomB, 123)).resolves.toBeUndefined();
    expect(await store.all()).toHaveLength(0);
  });

  it("clear empties the store", async () => {
    const store = new KnownRoomsStore();
    await store.upsert({ roomId: roomA, displayName: "Room", relayHost: "r", joinedAt: 1, lastActivityAt: 1 });
    await store.clear();
    expect(await store.all()).toHaveLength(0);
  });
});
