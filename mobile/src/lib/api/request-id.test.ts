/* eslint-disable import/no-unresolved */
// @ts-ignore
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRequestId, REQUEST_ID_PATTERN } from './request-id';

describe('createRequestId', () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  it('generates a valid RFC 4122 UUID v4 string', () => {
    const id = createRequestId();
    expect(id).toMatch(REQUEST_ID_PATTERN);
    expect(REQUEST_ID_PATTERN.test(id)).toBe(true);
  });

  it('generates unique IDs across successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = createRequestId();
      expect(REQUEST_ID_PATTERN.test(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });

  it('uses crypto.randomUUID() when available in the environment', () => {
    const mockUuid = '12345678-1234-4234-8234-123456789abc';
    const randomUUIDMock = vi.fn().mockReturnValue(mockUuid);

    Object.defineProperty(globalThis, 'crypto', {
      value: {
        ...originalCrypto,
        randomUUID: randomUUIDMock,
      },
      writable: true,
      configurable: true,
    });

    const id = createRequestId();
    expect(randomUUIDMock).toHaveBeenCalled();
    expect(id).toBe(mockUuid);
    expect(REQUEST_ID_PATTERN.test(id)).toBe(true);
  });

  it('falls back to crypto.getRandomValues() when randomUUID is unavailable', () => {
    const getRandomValuesMock = vi.fn((buffer: Uint8Array) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i * 16;
      }
      return buffer;
    });

    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: getRandomValuesMock,
      },
      writable: true,
      configurable: true,
    });

    const id = createRequestId();
    expect(getRandomValuesMock).toHaveBeenCalled();
    expect(id).toMatch(REQUEST_ID_PATTERN);
    expect(id.charAt(14)).toBe('4'); // version 4
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19).toLowerCase()); // variant
  });

  it('falls back to pseudo-random byte generation when crypto is undefined', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const id = createRequestId();
    expect(id).toMatch(REQUEST_ID_PATTERN);
    expect(id.charAt(14)).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19).toLowerCase());
  });
});
