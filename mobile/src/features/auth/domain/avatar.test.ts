// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
}));
import { AvatarTokens } from '@/constants/theme';

import { getAvatarColor, getInitials } from './avatar';

describe('getInitials', () => {
  it('returns first letter of first word and first letter of last word for 3-word names (e.g. "Rangga Hadi Putra" -> "RP")', () => {
    expect(getInitials('Rangga Hadi Putra')).toBe('RP');
    expect(getInitials('rangga hadi putra')).toBe('RP');
    expect(getInitials('John Fitzgerald Kennedy')).toBe('JK');
  });

  it('returns first letters for 2-word names (e.g. "Jane Doe" -> "JD")', () => {
    expect(getInitials('Jane Doe')).toBe('JD');
    expect(getInitials('Alex Rivers')).toBe('AR');
  });

  it('returns first 2 letters for single-word names (e.g. "Rangga" -> "RA")', () => {
    expect(getInitials('Rangga')).toBe('RA');
    expect(getInitials('joy')).toBe('JO');
  });

  it('returns single letter for 1-character names', () => {
    expect(getInitials('A')).toBe('A');
    expect(getInitials('z')).toBe('Z');
  });

  it('returns fallback for null, undefined, empty, or whitespace-only inputs', () => {
    expect(getInitials(null)).toBe('U');
    expect(getInitials(undefined)).toBe('U');
    expect(getInitials('')).toBe('U');
    expect(getInitials('   ')).toBe('U');
    expect(getInitials(null, 'JP')).toBe('JP');
  });

  it('handles multiple extra spaces gracefully', () => {
    expect(getInitials('  Elon   Reeve   Musk  ')).toBe('EM');
  });
});

describe('getAvatarColor', () => {
  it('returns a deterministic color from the palette for the same name/seed', () => {
    const color1 = getAvatarColor('Rangga Hadi Putra');
    const color2 = getAvatarColor('Rangga Hadi Putra');
    expect(color1).toBe(color2);
    expect(AvatarTokens.palette).toContain(color1);
  });

  it('is case-insensitive for consistency', () => {
    expect(getAvatarColor('rangga hadi putra')).toBe(getAvatarColor('Rangga Hadi Putra'));
  });

  it('returns default palette color for empty or null seeds', () => {
    expect(getAvatarColor(null)).toBe(AvatarTokens.palette[0]);
    expect(getAvatarColor(undefined)).toBe(AvatarTokens.palette[0]);
    expect(getAvatarColor('')).toBe(AvatarTokens.palette[0]);
    expect(getAvatarColor('   ')).toBe(AvatarTokens.palette[0]);
  });

  it('supports custom palette arrays', () => {
    const customPalette = ['#111111', '#222222', '#333333'] as const;
    const color = getAvatarColor('Test User', customPalette);
    expect(customPalette).toContain(color);
  });
});
