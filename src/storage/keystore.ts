/**
 * Seed-at-rest storage (android/CLAUDE.md's equivalent of the Keystore-encrypted vault, browser
 * version - webclient/CLAUDE.md): a non-extractable AES-GCM-256 WebCrypto key, generated once and
 * stored directly in IndexedDB (browsers support storing a `CryptoKey` object itself via
 * structured clone - confirmed working here, including for non-extractable keys, via Node's own
 * WebCrypto + fake-indexeddb in this file's test). The raw seed bytes never touch disk unencrypted
 * and the wrapping key itself can never be exported, even by code running in this same origin.
 */

const DB_NAME = "squaddle-keystore";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const SEED_STORE = "seed";
const WRAP_KEY_ID = "wrap-key";
const SEED_RECORD_ID = "seed";

interface EncryptedSeedRecord {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(SEED_STORE)) db.createObjectStore(SEED_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: unknown, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOrCreateWrapKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(db, KEY_STORE, WRAP_KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idbPut(db, KEY_STORE, key, WRAP_KEY_ID);
  return key;
}

export interface Keystore {
  saveSeed(seed: Uint8Array<ArrayBuffer>): Promise<void>;
  loadSeed(): Promise<Uint8Array<ArrayBuffer> | null>;
  clear(): Promise<void>;
}

export class IndexedDbKeystore implements Keystore {
  async saveSeed(seed: Uint8Array<ArrayBuffer>): Promise<void> {
    const db = await openDb();
    const key = await getOrCreateWrapKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, seed);
    const record: EncryptedSeedRecord = { iv, ciphertext };
    await idbPut(db, SEED_STORE, record, SEED_RECORD_ID);
  }

  async loadSeed(): Promise<Uint8Array<ArrayBuffer> | null> {
    const db = await openDb();
    const key = await idbGet<CryptoKey>(db, KEY_STORE, WRAP_KEY_ID);
    const record = await idbGet<EncryptedSeedRecord>(db, SEED_STORE, SEED_RECORD_ID);
    if (!key || !record) return null;
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, key, record.ciphertext);
    return new Uint8Array(plaintext);
  }

  async clear(): Promise<void> {
    const db = await openDb();
    await idbClear(db, KEY_STORE);
    await idbClear(db, SEED_STORE);
  }
}
