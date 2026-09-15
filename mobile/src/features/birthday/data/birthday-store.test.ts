import { beforeEach, describe, expect, it, vi } from 'vitest';

const memoryStorage: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => memoryStorage[key] ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    memoryStorage[key] = value;
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete memoryStorage[key];
  }),
}));

import {
  claimBirthday,
  hydrateBirthdayClaim,
  isBirthdayClaimed,
  isBirthdayClaimedSync,
  isBirthdayEligible,
  resetBirthdayClaim,
  shouldShowBirthdayOnboarding,
} from './birthday-store';

describe('birthday-store', () => {
  const targetEmail = 'devsolichin@gmail.com';
  const otherEmail = 'user@example.com';

  beforeEach(async () => {
    await resetBirthdayClaim(targetEmail);
    await resetBirthdayClaim(otherEmail);
  });

  describe('isBirthdayEligible', () => {
    it('returns true for target email devsolichin@gmail.com (case-insensitive)', () => {
      expect(isBirthdayEligible('devsolichin@gmail.com')).toBe(true);
      expect(isBirthdayEligible('DEVSOLICHIN@GMAIL.COM')).toBe(true);
      expect(isBirthdayEligible('  devsolichin@gmail.com  ')).toBe(true);
    });

    it('returns false for other emails', () => {
      expect(isBirthdayEligible('audi@example.com')).toBe(false);
      expect(isBirthdayEligible(null)).toBe(false);
      expect(isBirthdayEligible(undefined)).toBe(false);
      expect(isBirthdayEligible('')).toBe(false);
    });
  });

  describe('claim lifecycle', () => {
    it('shows onboarding for target email before claiming, and hides it after claim', async () => {
      expect(isBirthdayClaimedSync(targetEmail)).toBe(false);
      expect(shouldShowBirthdayOnboarding(targetEmail)).toBe(true);

      await claimBirthday(targetEmail);

      expect(isBirthdayClaimedSync(targetEmail)).toBe(true);
      expect(await isBirthdayClaimed(targetEmail)).toBe(true);
      expect(shouldShowBirthdayOnboarding(targetEmail)).toBe(false);
    });

    it('never shows onboarding for non-target emails even when unclaimed', () => {
      expect(shouldShowBirthdayOnboarding(otherEmail)).toBe(false);
    });

    it('can reset claim', async () => {
      await claimBirthday(targetEmail);
      expect(shouldShowBirthdayOnboarding(targetEmail)).toBe(false);

      await resetBirthdayClaim(targetEmail);
      expect(shouldShowBirthdayOnboarding(targetEmail)).toBe(true);
    });

    it('hydrates claim status from SecureStore', async () => {
      await claimBirthday(targetEmail);
      const isClaimed = await hydrateBirthdayClaim(targetEmail);
      expect(isClaimed).toBe(true);
    });
  });
});
