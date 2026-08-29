import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type StoredMemoryProfile = {
  occupation: string;
  moreAboutYou: string;
};

const EMPTY_PROFILE: StoredMemoryProfile = {
  occupation: '',
  moreAboutYou: '',
};

function storageKey(userId: string): string {
  return `joy.memory-profile.${userId}`;
}

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

function isStoredMemoryProfile(value: unknown): value is StoredMemoryProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as StoredMemoryProfile;
  return typeof record.occupation === 'string' && typeof record.moreAboutYou === 'string';
}

export async function loadMemoryProfile(userId: string): Promise<StoredMemoryProfile> {
  const raw = await getItem(storageKey(userId));
  if (!raw) {
    return EMPTY_PROFILE;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredMemoryProfile(parsed) ? parsed : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function saveMemoryProfile(
  userId: string,
  profile: StoredMemoryProfile,
): Promise<void> {
  await setItem(storageKey(userId), JSON.stringify(profile));
}
