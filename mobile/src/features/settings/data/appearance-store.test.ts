// @ts-nocheck
/* eslint-disable import/no-unresolved, import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppearance = {
  colorScheme: 'light' as 'light' | 'dark' | null,
  listeners: [] as ((preferences: { colorScheme: 'light' | 'dark' | null }) => void)[],
  getColorScheme() {
    return this.colorScheme;
  },
  setColorScheme: vi.fn(),
  addChangeListener(listener: (preferences: { colorScheme: 'light' | 'dark' | null }) => void) {
    this.listeners.push(listener);
    return {
      remove: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx !== -1) {
          this.listeners.splice(idx, 1);
        }
      },
    };
  },
};

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  Appearance: {
    getColorScheme: () => mockAppearance.getColorScheme(),
    setColorScheme: (scheme: string | null) => mockAppearance.setColorScheme(scheme),
    addChangeListener: (l: (preferences: { colorScheme: 'light' | 'dark' | null }) => void) =>
      mockAppearance.addChangeListener(l),
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
  getAppearancePreference,
  getResolvedColorScheme,
  resetAppearanceStoreForTest,
  setAppearancePreference,
  subscribeAppearance,
} from './appearance-store';

describe('appearance-store', () => {
  beforeEach(() => {
    mockAppearance.colorScheme = 'light';
    mockAppearance.listeners = [];
    resetAppearanceStoreForTest();
    vi.restoreAllMocks();
  });

  it('defaults to system appearance preference', () => {
    expect(getAppearancePreference()).toBe('system');
  });

  it('resolves color scheme based on system when preference is system', () => {
    mockAppearance.colorScheme = 'dark';
    expect(getResolvedColorScheme()).toBe('dark');

    mockAppearance.colorScheme = 'light';
    expect(getResolvedColorScheme()).toBe('light');

    mockAppearance.colorScheme = null;
    expect(getResolvedColorScheme()).toBe('light');
  });

  it('updates appearance preference and notifies listeners', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAppearance(listener);

    await setAppearancePreference('dark');

    expect(getAppearancePreference()).toBe('dark');
    expect(getResolvedColorScheme()).toBe('dark');
    expect(listener).toHaveBeenCalled();

    await setAppearancePreference('light');
    expect(getAppearancePreference()).toBe('light');
    expect(getResolvedColorScheme()).toBe('light');

    unsubscribe();
  });
  it('calls Appearance.setColorScheme when updating preference', async () => {
    await setAppearancePreference('dark');
    expect(mockAppearance.setColorScheme).toHaveBeenCalledWith('dark');

    await setAppearancePreference('system');
    expect(mockAppearance.setColorScheme).toHaveBeenCalledWith('unspecified');
  });


  it('notifies subscribers when system color scheme changes in system mode', () => {
    const listener = vi.fn();
    subscribeAppearance(listener);

    mockAppearance.colorScheme = 'dark';
    mockAppearance.listeners.forEach((l) => l({ colorScheme: 'dark' }));

    expect(listener).toHaveBeenCalled();
  });

  it('ignores invalid preference values', async () => {
    // @ts-expect-error test invalid value
    await setAppearancePreference('invalid_theme');
    expect(getAppearancePreference()).toBe('system');
  });
});
