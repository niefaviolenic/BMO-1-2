import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SessionStore } from '../domain/session-store';
import type { PersistedAuth } from '../domain/types';

const SESSION_KEY = 'joy.auth.session';
const CLIENT_DEVICE_KEY = 'joy.auth.device_id';

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

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function createClientDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isPersistedAuth(value: unknown): value is PersistedAuth {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as PersistedAuth;
  return (
    typeof record.user?.id === 'string' &&
    typeof record.session?.accessToken === 'string' &&
    typeof record.session?.refreshToken === 'string'
  );
}

export const secureSessionStore: SessionStore = {
  async load() {
    const raw = await getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return isPersistedAuth(parsed) ? parsed : null;
    } catch {
      await deleteItem(SESSION_KEY);
      return null;
    }
  },

  async save(value) {
    await setItem(SESSION_KEY, JSON.stringify(value));
  },

  async clear() {
    await deleteItem(SESSION_KEY);
  },

  async getOrCreateClientDeviceId() {
    const existing = await getItem(CLIENT_DEVICE_KEY);
    if (existing) {
      return existing;
    }

    const next = createClientDeviceId();
    await setItem(CLIENT_DEVICE_KEY, next);
    return next;
  },
};
