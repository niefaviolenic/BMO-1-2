export const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bytesToUuid(bytes: Uint8Array | number[]): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/**
 * Generates an RFC 4122 standard UUID v4 string (e.g. xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
 * Uses crypto.randomUUID() when available in the environment, with a robust fallback
 * for Hermes / React Native environments using crypto.getRandomValues() or pseudo-random byte generation.
 */
export function createRequestId(): string {
  const cryptoObj =
    (typeof globalThis !== 'undefined' && globalThis.crypto) ||
    (typeof crypto !== 'undefined' ? crypto : undefined);

  if (typeof cryptoObj?.randomUUID === 'function') {
    try {
      const id = cryptoObj.randomUUID();
      if (REQUEST_ID_PATTERN.test(id)) {
        return id;
      }
    } catch {
      // Fall through to byte-based generation
    }
  }

  if (typeof cryptoObj?.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 v4 version
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
      const id = bytesToUuid(bytes);
      if (REQUEST_ID_PATTERN.test(id)) {
        return id;
      }
    } catch {
      // Fall through to pseudo-random generator
    }
  }

  // Pseudo-random byte fallback conforming to RFC 4122 v4
  const bytes: number[] = new Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}
