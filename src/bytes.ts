import { EncodingApi } from "core";

export function roomIdToB32(roomId: Int8Array): string {
  return EncodingApi.getInstance().base32Encode(roomId);
}

export function b32ToRoomId(text: string): Int8Array | null {
  return EncodingApi.getInstance().base32Decode(text) ?? null;
}

export function bytesEqual(a: Int8Array, b: Int8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
