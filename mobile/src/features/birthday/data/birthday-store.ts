import * as SecureStore from 'expo-secure-store';

export const BIRTHDAY_TARGET_EMAILS: Record<string, true> = {
  'devsolichin@gmail.com': true,
};

const STORAGE_PREFIX = 'joy_birthday_claimed_';
const inMemoryClaimedCache: Record<string, boolean> = {};

function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function isBirthdayEligible(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return Boolean(BIRTHDAY_TARGET_EMAILS[normalized]);
}

export async function hydrateBirthdayClaim(email?: string | null): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  try {
    const raw = await SecureStore.getItemAsync(`${STORAGE_PREFIX}${normalized}`);
    const isClaimed = raw === 'true';
    inMemoryClaimedCache[normalized] = isClaimed;
    return isClaimed;
  } catch {
    return inMemoryClaimedCache[normalized] ?? false;
  }
}

export function isBirthdayClaimedSync(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return Boolean(inMemoryClaimedCache[normalized]);
}

export async function isBirthdayClaimed(email?: string | null): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  if (inMemoryClaimedCache[normalized] !== undefined) {
    return inMemoryClaimedCache[normalized];
  }

  return hydrateBirthdayClaim(normalized);
}

export async function claimBirthday(email?: string | null): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  inMemoryClaimedCache[normalized] = true;

  try {
    await SecureStore.setItemAsync(`${STORAGE_PREFIX}${normalized}`, 'true');
  } catch {
    // Graceful fallback for storage errors
  }
}

export async function resetBirthdayClaim(email?: string | null): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  delete inMemoryClaimedCache[normalized];

  try {
    await SecureStore.deleteItemAsync(`${STORAGE_PREFIX}${normalized}`);
  } catch {
    // Graceful fallback
  }
}

export function shouldShowBirthdayOnboarding(email?: string | null): boolean {
  if (!isBirthdayEligible(email)) {
    return false;
  }
  return !isBirthdayClaimedSync(email);
}
