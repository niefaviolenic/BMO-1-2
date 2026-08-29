/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGoogleAuthStartUrl,
  parseGoogleAuthCallbackUrl,
  promptGoogleAuth,
} from './google-oauth';

const { mockOpenAuthSessionAsync } = vi.hoisted(() => ({
  mockOpenAuthSessionAsync: vi.fn(),
}));

vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(
    ({ scheme, path }: { scheme?: string; path?: string }) => `${scheme ?? ''}://${path ?? ''}`,
  ),
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: {} },
}));
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
}));

describe('google-oauth backend-mediated flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildGoogleAuthStartUrl', () => {
    it('constructs start URL with encoded returnUrl', () => {
      const returnUrl = 'joymobile://auth/callback';
      const startUrl = buildGoogleAuthStartUrl(returnUrl);

      expect(startUrl).toContain('/auth/google/start');
      expect(startUrl).toContain(`returnUrl=${encodeURIComponent(returnUrl)}`);
    });
  });

  describe('parseGoogleAuthCallbackUrl', () => {
    it('extracts code from callback URL', () => {
      const result = parseGoogleAuthCallbackUrl('joymobile://auth/callback?code=ex_code_12345');
      expect(result).toEqual({ code: 'ex_code_12345', error: undefined });
    });

    it('extracts error from callback URL', () => {
      const result = parseGoogleAuthCallbackUrl('joymobile://auth/callback?error=access_denied');
      expect(result).toEqual({ code: undefined, error: 'access_denied' });
    });

    it('returns empty object when no query params present', () => {
      const result = parseGoogleAuthCallbackUrl('joymobile://auth/callback');
      expect(result).toEqual({});
    });
  });

  describe('promptGoogleAuth', () => {
    it('returns exchangeCode on successful auth session redirect', async () => {
      mockOpenAuthSessionAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'joymobile://auth/callback?code=mock_exchange_code_abc',
      });

      const result = await promptGoogleAuth();
      expect(result).toEqual({ exchangeCode: 'mock_exchange_code_abc' });
      expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
        expect.stringContaining('/auth/google/start?returnUrl='),
        'joymobile://auth/callback',
      );
    });

    it('throws error when user cancels or dismisses auth browser', async () => {
      mockOpenAuthSessionAsync.mockResolvedValueOnce({
        type: 'cancel',
      });

      await expect(promptGoogleAuth()).rejects.toThrow('Google Sign-In was cancelled.');
    });

    it('throws error when callback URL contains error parameter', async () => {
      mockOpenAuthSessionAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'joymobile://auth/callback?error=invalid_scope',
      });

      await expect(promptGoogleAuth()).rejects.toThrow('Google Sign-In failed: invalid_scope');
    });

    it('throws error when callback URL does not contain a code', async () => {
      mockOpenAuthSessionAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'joymobile://auth/callback',
      });

      await expect(promptGoogleAuth()).rejects.toThrow('No authorization code returned from Google login.');
    });
  });
});
