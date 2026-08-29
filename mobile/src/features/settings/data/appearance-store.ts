import * as SecureStore from 'expo-secure-store';
import { Appearance, Platform } from 'react-native';

import type { AppearanceMode } from '../domain/theme/types';

const APPEARANCE_KEY = 'joy.appearance.preference';

type Listener = () => void;

const listeners = new Set<Listener>();
let currentPreference: AppearanceMode = 'system';
let isHydrated = false;
let hydratePromise: Promise<AppearanceMode> | null = null;
let appearanceListenerBound = false;

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

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'dark' || value === 'light';
}

function bindSystemAppearanceListener(): void {
  if (appearanceListenerBound) {
    return;
  }
  appearanceListenerBound = true;

  try {
    if (typeof Appearance !== 'undefined' && Appearance && typeof Appearance.addChangeListener === 'function') {
      Appearance.addChangeListener(() => {
        if (currentPreference === 'system') {
          emit();
        }
      });
    }
  } catch {
    // Ignore in unsupported/mocked environments
  }
}
function applyNativeColorScheme(mode: AppearanceMode): void {
  try {
    if (typeof Appearance !== 'undefined' && Appearance && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    }
  } catch {
    // Ignore if unsupported in environment
  }
}


export async function hydrateAppearancePreference(): Promise<AppearanceMode> {
  if (isHydrated) {
    return currentPreference;
  }
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = (async () => {
    try {
      const raw = await getItem(APPEARANCE_KEY);
      if (raw && isAppearanceMode(raw)) {
        currentPreference = raw;
      }
    } catch {
      // Fallback to default 'system'
    } finally {
      isHydrated = true;
      hydratePromise = null;
      applyNativeColorScheme(currentPreference);
      emit();
    }
    return currentPreference;
  })();

  return hydratePromise;
}

export function getAppearancePreference(): AppearanceMode {
  bindSystemAppearanceListener();
  return currentPreference;
}

export function getResolvedColorScheme(): 'light' | 'dark' {
  bindSystemAppearanceListener();
  if (currentPreference === 'dark') {
    return 'dark';
  }
  if (currentPreference === 'light') {
    return 'light';
  }

  let systemScheme: string | null | undefined = null;
  try {
    if (typeof Appearance !== 'undefined' && Appearance) {
      systemScheme = Appearance.getColorScheme?.();
    }
  } catch {
    // Ignore in mocked environments
  }
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export async function setAppearancePreference(mode: AppearanceMode): Promise<void> {
  if (!isAppearanceMode(mode)) {
    return;
  }

  currentPreference = mode;
  applyNativeColorScheme(mode);
  emit();

  await setItem(APPEARANCE_KEY, mode);
}

export function subscribeAppearance(listener: Listener): () => void {
  bindSystemAppearanceListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAppearanceStoreForTest(): void {
  listeners.clear();
  currentPreference = 'system';
  isHydrated = false;
  hydratePromise = null;
  appearanceListenerBound = false;
}

// Warm up hydration on load
void hydrateAppearancePreference();
