/**
 * Local-only known-rooms bookkeeping - mirrors android's `AppLocalStore`/`AppLocalDb.sq`
 * ("room display names, read cursors ... none of this has protocol meaning"). Plain IndexedDB,
 * not core's `LocalStore` (that's protocol-level log/op storage, a different concern entirely).
 */

const DB_NAME = "squaddle-known-rooms";
const DB_VERSION = 1;
const ROOMS_STORE = "rooms";

export interface KnownRoom {
  roomId: Int8Array;
  displayName: string;
  relayHost: string;
  joinedAt: number;
  lastActivityAt: number;
}

interface StoredRoom {
  roomIdB64: string;
  roomId: Uint8Array;
  displayName: string;
  relayHost: string;
  joinedAt: number;
  lastActivityAt: number;
}

function toBase64Key(bytes: Int8Array | Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte & 0xff);
  return btoa(binary);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(ROOMS_STORE)) {
        req.result.createObjectStore(ROOMS_STORE, { keyPath: "roomIdB64" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class KnownRoomsStore {
  async upsert(room: KnownRoom): Promise<void> {
    const db = await openDb();
    const stored: StoredRoom = {
      roomIdB64: toBase64Key(room.roomId),
      roomId: new Uint8Array(room.roomId),
      displayName: room.displayName,
      relayHost: room.relayHost,
      joinedAt: room.joinedAt,
      lastActivityAt: room.lastActivityAt,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROOMS_STORE, "readwrite");
      tx.objectStore(ROOMS_STORE).put(stored);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async touchActivity(roomId: Int8Array | Uint8Array, lastActivityAt: number): Promise<void> {
    const db = await openDb();
    const key = toBase64Key(roomId);
    const existing = await new Promise<StoredRoom | undefined>((resolve, reject) => {
      const req = db.transaction(ROOMS_STORE, "readonly").objectStore(ROOMS_STORE).get(key);
      req.onsuccess = () => resolve(req.result as StoredRoom | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!existing) return;
    existing.lastActivityAt = lastActivityAt;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROOMS_STORE, "readwrite");
      tx.objectStore(ROOMS_STORE).put(existing);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Sorted by most-recently-active first, matching android's `RoomsListViewModel` convention. */
  async all(): Promise<KnownRoom[]> {
    const db = await openDb();
    const rows = await new Promise<StoredRoom[]>((resolve, reject) => {
      const req = db.transaction(ROOMS_STORE, "readonly").objectStore(ROOMS_STORE).getAll();
      req.onsuccess = () => resolve(req.result as StoredRoom[]);
      req.onerror = () => reject(req.error);
    });
    return rows
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .map((r) => ({
        roomId: new Int8Array(r.roomId),
        displayName: r.displayName,
        relayHost: r.relayHost,
        joinedAt: r.joinedAt,
        lastActivityAt: r.lastActivityAt,
      }));
  }

  async clear(): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROOMS_STORE, "readwrite");
      tx.objectStore(ROOMS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
