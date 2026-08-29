import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PINNED_KEY = 'joy.pinned-chat-sessions';

type Listener = () => void;

const listeners = new Set<Listener>();
let cachedPinnedIds: string[] = [];
let isLoaded = false;
let loadPromise: Promise<string[]> | null = null;

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function loadPinnedSessionIds(): Promise<string[]> {
  if (isLoaded) {
    return cachedPinnedIds;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const raw = await getItem(PINNED_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isStringArray(parsed)) {
          cachedPinnedIds = parsed;
        }
      }
    } catch {
      // Ignore parse / storage errors and keep empty array
    } finally {
      isLoaded = true;
      loadPromise = null;
      emit();
    }
    return cachedPinnedIds;
  })();

  return loadPromise;
}

export function getPinnedSessionIds(): string[] {
  return cachedPinnedIds;
}

export function subscribePinnedSessions(listener: Listener): () => void {
  listeners.add(listener);
  if (!isLoaded && !loadPromise) {
    void loadPinnedSessionIds();
  }
  return () => {
    listeners.delete(listener);
  };
}

export async function pinSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  if (!isLoaded) {
    await loadPinnedSessionIds();
  }
  if (cachedPinnedIds.includes(sessionId)) {
    return;
  }
  cachedPinnedIds = [sessionId, ...cachedPinnedIds];
  emit();
  await setItem(PINNED_KEY, JSON.stringify(cachedPinnedIds));
}

export async function unpinSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  if (!isLoaded) {
    await loadPinnedSessionIds();
  }
  if (!cachedPinnedIds.includes(sessionId)) {
    return;
  }
  cachedPinnedIds = cachedPinnedIds.filter((id) => id !== sessionId);
  emit();
  await setItem(PINNED_KEY, JSON.stringify(cachedPinnedIds));
}

export function isSessionPinned(sessionId: string): boolean {
  return cachedPinnedIds.includes(sessionId);
}

export async function cleanupDeletedSession(sessionId: string): Promise<void> {
  if (isSessionPinned(sessionId)) {
    await unpinSession(sessionId);
  }
}

// Warm up the cache immediately on module load
void loadPinnedSessionIds();
