// @ts-nocheck
/* eslint-disable import/no-unresolved, import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppearance = {
  colorScheme: 'light' as 'light' | 'dark' | null,
  listeners: [] as ((preferences: { colorScheme: 'light' | 'dark' | null }) => void)[],
  getColorScheme() {
    return this.colorScheme;
  },
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
    addChangeListener: (l: (preferences: { colorScheme: 'light' | 'dark' | null }) => void) =>
      mockAppearance.addChangeListener(l),
  },
}));

vi.mock('react', () => ({
  useSyncExternalStore: (
    _subscribe: unknown,
    getSnapshot: () => unknown,
    _getServerSnapshot?: () => unknown,
  ) => getSnapshot(),
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

import { resetAppearanceStoreForTest } from '../data/appearance-store';
import { useAppearance } from './use-appearance';

describe('useAppearance hook', () => {
  beforeEach(() => {
    mockAppearance.colorScheme = 'light';
    mockAppearance.listeners = [];
    resetAppearanceStoreForTest();
    vi.restoreAllMocks();
  });

  it('returns initial default state of system appearance', () => {
    const result = useAppearance();
    expect(result.appearance).toBe('system');
    expect(result.appearanceLabel).toBe('System');
    expect(result.resolvedColorScheme).toBe('light');
  });

  it('updates appearance and resolved color scheme when setAppearance is called', async () => {
    const result = useAppearance();

    await result.setAppearance('dark');

    const updated = useAppearance();
    expect(updated.appearance).toBe('dark');
    expect(updated.appearanceLabel).toBe('Dark');
    expect(updated.resolvedColorScheme).toBe('dark');

    await result.setAppearance('light');
    const lightResult = useAppearance();
    expect(lightResult.appearance).toBe('light');
    expect(lightResult.appearanceLabel).toBe('Light');
    expect(lightResult.resolvedColorScheme).toBe('light');
  });
});
