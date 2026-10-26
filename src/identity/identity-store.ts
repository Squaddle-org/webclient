import { IdentityApi } from "core";
import type { Keystore } from "../storage/keystore";
import { decodeIdentityRecord, encodeIdentityRecord, type IdentityRecord } from "./identity-record";

function toUint8Array(bytes: Int8Array): Uint8Array<ArrayBuffer> {
  // A view reinterpretation, not a copy of transformed values - same bits, just read as
  // unsigned instead of signed. Safe for opaque byte blobs that are never used in arithmetic.
  return new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Create/restore identity, mirroring android's `OnboardingViewModel`: a device keypair is
 * always freshly minted (PROTOCOL.md §2.1 - never derived from the seed), for both paths. The
 * mnemonic is returned only once, right after `create()` - callers must show it to the user
 * before it's gone (nothing else in this module ever holds onto it).
 */
export class IdentityStore {
  constructor(private readonly keystore: Keystore) {}

  async hasIdentity(): Promise<boolean> {
    return (await this.keystore.loadSeed()) !== null;
  }

  async create(deviceLabel: string): Promise<{ mnemonic: string[] }> {
    const result = await IdentityApi.getInstance().create(deviceLabel);
    await this.persist(result);
    return { mnemonic: result.mnemonic };
  }

  /** `null` if [words] is not a valid 24-word BIP39 mnemonic. */
  async restore(words: string[], deviceLabel: string): Promise<boolean> {
    const result = await IdentityApi.getInstance().restore(words, deviceLabel);
    if (!result) return false;
    await this.persist(result);
    return true;
  }

  async load(): Promise<IdentityRecord | null> {
    const seed = await this.keystore.loadSeed();
    return seed ? decodeIdentityRecord(seed) : null;
  }

  private async persist(result: {
    entropy: Int8Array;
    devicePublicKey: Int8Array;
    deviceSecretKey: Int8Array;
    deviceCertUser: Int8Array;
    deviceCertUserBox: Int8Array;
    deviceCertLabel: string;
    deviceCertIssuedAt: number;
    deviceCertSig: Int8Array;
  }): Promise<void> {
    const record: IdentityRecord = {
      entropy: toUint8Array(result.entropy),
      devicePublicKey: toUint8Array(result.devicePublicKey),
      deviceSecretKey: toUint8Array(result.deviceSecretKey),
      deviceCertUser: toUint8Array(result.deviceCertUser),
      deviceCertUserBox: toUint8Array(result.deviceCertUserBox),
      deviceCertLabel: result.deviceCertLabel,
      deviceCertIssuedAt: result.deviceCertIssuedAt,
      deviceCertSig: toUint8Array(result.deviceCertSig),
    };
    await this.keystore.saveSeed(encodeIdentityRecord(record));
  }
}
