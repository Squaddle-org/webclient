import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbKeystore } from "../storage/keystore";
import { IdentityStore } from "./identity-store";

beforeEach(async () => {
  await new IndexedDbKeystore().clear();
});

describe("IdentityStore", () => {
  it("hasIdentity() is false before create()/restore()", async () => {
    const store = new IdentityStore(new IndexedDbKeystore());
    expect(await store.hasIdentity()).toBe(false);
  });

  it("create() persists a real identity with a 24-word mnemonic", async () => {
    const store = new IdentityStore(new IndexedDbKeystore());
    const { mnemonic } = await store.create("Test Device");

    expect(mnemonic.length).toBe(24);
    expect(await store.hasIdentity()).toBe(true);

    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.devicePublicKey.length).toBe(32);
    expect(loaded!.deviceCertSig.length).toBe(64);
    expect(loaded!.deviceCertLabel).toBe("Test Device");
  });

  it("restore() persists the same user keys but a fresh device", async () => {
    const creator = new IdentityStore(new IndexedDbKeystore());
    const { mnemonic } = await creator.create("Device A");
    const created = await creator.load();

    await new IndexedDbKeystore().clear(); // simulate a different browser/profile
    const restorer = new IdentityStore(new IndexedDbKeystore());
    const ok = await restorer.restore(mnemonic, "Device B");
    const restored = await restorer.load();

    expect(ok).toBe(true);
    expect(restored!.entropy).toEqual(created!.entropy);
    expect(restored!.devicePublicKey).not.toEqual(created!.devicePublicKey);
    expect(restored!.deviceCertLabel).toBe("Device B");
  });

  it("restore() rejects an invalid mnemonic and persists nothing", async () => {
    const store = new IdentityStore(new IndexedDbKeystore());
    const ok = await store.restore(["not", "a", "valid", "mnemonic"], "Device");

    expect(ok).toBe(false);
    expect(await store.hasIdentity()).toBe(false);
  });
});
