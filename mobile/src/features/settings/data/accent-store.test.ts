// @ts-nocheck
/* eslint-disable import/no-unresolved, import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
}));

vi.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: vi.fn(async (key: string) => store[key] ?? null),
    setItemAsync: vi.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      delete store[key];
    }),
    _reset: () => {
      store = {};
    },
  };
});

import {
  getAccentPreference,
  getResolvedAccentDot,
  getResolvedAccentPrimary,
  resetAccentStoreForTest,
  setAccentPreference,
  subscribeAccent,
} from './accent-store';

describe('accent-store', () => {
  beforeEach(() => {
    resetAccentStoreForTest();
    vi.restoreAllMocks();
  });

  it('defaults to default accent preference', () => {
    expect(getAccentPreference()).toBe('default');
  });

  it('resolves accent dot and primary based on selected accent', async () => {
    expect(getResolvedAccentDot('light')).toBe('#007AFF');
    expect(getResolvedAccentDot('dark')).toBe('#0A84FF');

    await setAccentPreference('purple');
    expect(getAccentPreference()).toBe('purple');
    expect(getResolvedAccentDot('light')).toBe('#8B5CF6');
    expect(getResolvedAccentDot('dark')).toBe('#A855F7');
    expect(getResolvedAccentPrimary('light')).toBe('#8B5CF6');
  });

  it('updates accent preference and notifies subscribers', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccent(listener);

    await setAccentPreference('purple');
    expect(getAccentPreference()).toBe('purple');
    expect(listener).toHaveBeenCalled();

    await setAccentPreference('green');
    expect(getAccentPreference()).toBe('green');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('ignores invalid preference values', async () => {
    // @ts-expect-error test invalid value
    await setAccentPreference('invalid_accent');
    expect(getAccentPreference()).toBe('default');
  });
});
