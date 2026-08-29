import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  ACCENT_COLOR_OPTIONS,
  type AccentColorMode,
  getAccentOption,
} from '../domain/theme/types';

const ACCENT_STORAGE_KEY = 'joy.accent.preference';

type Listener = () => void;

const listeners = new Set<Listener>();
let currentAccent: AccentColorMode = 'default';
let isHydrated = false;
let hydratePromise: Promise<AccentColorMode> | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore storage write errors gracefully
  }
}

function isAccentColorMode(value: unknown): value is AccentColorMode {
  return typeof value === 'string' && ACCENT_COLOR_OPTIONS.some((opt) => opt.id === value);
}

export async function hydrateAccentPreference(): Promise<AccentColorMode> {
  if (isHydrated) {
    return currentAccent;
  }
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = (async () => {
    try {
      const raw = await getItem(ACCENT_STORAGE_KEY);
      if (raw && isAccentColorMode(raw)) {
        currentAccent = raw;
      }
    } catch {
      // Fallback to default
    } finally {
      isHydrated = true;
      hydratePromise = null;
      emit();
    }
    return currentAccent;
  })();

  return hydratePromise;
}

export function getAccentPreference(): AccentColorMode {
  return currentAccent;
}

export function getResolvedAccentDot(colorScheme: 'light' | 'dark' = 'light'): string {
  const option = getAccentOption(currentAccent);
  return colorScheme === 'dark' ? option.darkDot : option.lightDot;
}

export function getResolvedAccentPrimary(colorScheme: 'light' | 'dark' = 'light'): string {
  const option = getAccentOption(currentAccent);
  return colorScheme === 'dark' ? option.darkPrimary : option.lightPrimary;
}

export async function setAccentPreference(mode: AccentColorMode): Promise<void> {
  if (!isAccentColorMode(mode)) {
    return;
  }

  currentAccent = mode;
  emit();

  await setItem(ACCENT_STORAGE_KEY, mode);
}

export function subscribeAccent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAccentStoreForTest(): void {
  listeners.clear();
  currentAccent = 'default';
  isHydrated = false;
  hydratePromise = null;
}

// Warm up hydration on load
void hydrateAccentPreference();
