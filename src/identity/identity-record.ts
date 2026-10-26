/**
 * Everything that needs to survive a page reload after identity create/restore - the browser
 * equivalent of android's `IdentityRecord`/`IdentityRecordDto` (`crypto/IdentityVault.kt`): a
 * JSON DTO with byte fields base64-encoded, the whole thing encrypted at rest via
 * {@link Keystore}. `deviceCertIssuedAt` stays a plain `number` (seconds since epoch) - the
 * same reason `IdentityResult` uses `Double` on the Kotlin side (no 64-bit int in JS).
 */
export interface IdentityRecord {
  entropy: Uint8Array;
  devicePublicKey: Uint8Array;
  deviceSecretKey: Uint8Array;
  deviceCertUser: Uint8Array;
  deviceCertUserBox: Uint8Array;
  deviceCertLabel: string;
  deviceCertIssuedAt: number;
  deviceCertSig: Uint8Array;
}

interface IdentityRecordDto {
  entropy: string;
  devicePublicKey: string;
  deviceSecretKey: string;
  deviceCertUser: string;
  deviceCertUserBox: string;
  deviceCertLabel: string;
  deviceCertIssuedAt: number;
  deviceCertSig: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeIdentityRecord(record: IdentityRecord): Uint8Array<ArrayBuffer> {
  const dto: IdentityRecordDto = {
    entropy: toBase64(record.entropy),
    devicePublicKey: toBase64(record.devicePublicKey),
    deviceSecretKey: toBase64(record.deviceSecretKey),
    deviceCertUser: toBase64(record.deviceCertUser),
    deviceCertUserBox: toBase64(record.deviceCertUserBox),
    deviceCertLabel: record.deviceCertLabel,
    deviceCertIssuedAt: record.deviceCertIssuedAt,
    deviceCertSig: toBase64(record.deviceCertSig),
  };
  return new TextEncoder().encode(JSON.stringify(dto)) as Uint8Array<ArrayBuffer>;
}

export function decodeIdentityRecord(bytes: Uint8Array): IdentityRecord {
  const dto = JSON.parse(new TextDecoder().decode(bytes)) as IdentityRecordDto;
  return {
    entropy: fromBase64(dto.entropy),
    devicePublicKey: fromBase64(dto.devicePublicKey),
    deviceSecretKey: fromBase64(dto.deviceSecretKey),
    deviceCertUser: fromBase64(dto.deviceCertUser),
    deviceCertUserBox: fromBase64(dto.deviceCertUserBox),
    deviceCertLabel: dto.deviceCertLabel,
    deviceCertIssuedAt: dto.deviceCertIssuedAt,
    deviceCertSig: fromBase64(dto.deviceCertSig),
  };
}
