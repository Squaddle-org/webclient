import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbKeystore } from "./keystore";

// fake-indexeddb's global `indexedDB` object persists for the whole test-file run, so each test
// needs a clean slate - otherwise state from one test leaks into the next. clear() (not
// indexedDB.deleteDatabase) because IndexedDbKeystore never closes its connections (same as a
// real long-lived app page) - deleteDatabase blocks indefinitely behind any still-open
// connection, which would hang every test after the first.
beforeEach(async () => {
  await new IndexedDbKeystore().clear();
});

describe("IndexedDbKeystore", () => {
  it("returns null when nothing has been saved yet", async () => {
    const ks = new IndexedDbKeystore();
    expect(await ks.loadSeed()).toBeNull();
  });

  it("round-trips a saved seed", async () => {
    const ks = new IndexedDbKeystore();
    const seed = crypto.getRandomValues(new Uint8Array(32));

    await ks.saveSeed(seed);
    const loaded = await ks.loadSeed();

    expect(loaded).toEqual(seed);
  });

  it("overwrites a previously saved seed", async () => {
    const ks = new IndexedDbKeystore();
    const first = new Uint8Array(32).fill(1);
    const second = new Uint8Array(32).fill(2);

    await ks.saveSeed(first);
    await ks.saveSeed(second);
    const loaded = await ks.loadSeed();

    expect(loaded).toEqual(second);
  });

  it("clear() removes the seed and the wrapping key", async () => {
    const ks = new IndexedDbKeystore();
    await ks.saveSeed(crypto.getRandomValues(new Uint8Array(32)));

    await ks.clear();

    expect(await ks.loadSeed()).toBeNull();
  });

  it("decrypts correctly across repeated save/load cycles with the same stored key", async () => {
    const ks = new IndexedDbKeystore();
    const seed = crypto.getRandomValues(new Uint8Array(32));

    await ks.saveSeed(seed);
    const firstLoad = await ks.loadSeed();
    await ks.saveSeed(seed);
    const secondLoad = await ks.loadSeed();

    expect(firstLoad).toEqual(seed);
    expect(secondLoad).toEqual(seed);
  });
});
