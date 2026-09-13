/* eslint-disable import/no-unresolved */
// @ts-ignore
import { describe, expect, it } from 'vitest';

import {
  classifyQrPayload,
  conversationAvatarColor,
  formatWhatsAppDisplayNumber,
  isWhatsAppConnected,
  secondsUntilExpiry,
  toWhatsAppE164,
} from './whatsapp';

describe('formatWhatsAppDisplayNumber', () => {
  it('returns empty string for null, undefined, or empty string', () => {
    expect(formatWhatsAppDisplayNumber(null)).toBe('');
    expect(formatWhatsAppDisplayNumber(undefined)).toBe('');
    expect(formatWhatsAppDisplayNumber('')).toBe('');
    expect(formatWhatsAppDisplayNumber('   ')).toBe('');
  });

  it('formats Indonesian E.164 phone numbers nicely', () => {
    expect(formatWhatsAppDisplayNumber('+628993000101')).toBe('+62 899-3000-101');
    expect(formatWhatsAppDisplayNumber('628993000101')).toBe('+62 899-3000-101');
    expect(formatWhatsAppDisplayNumber('+6285189351510')).toBe('+62 851-8935-1510');
    expect(formatWhatsAppDisplayNumber('+6281234567890')).toBe('+62 812-3456-7890');
  });

  it('preserves already formatted strings', () => {
    expect(formatWhatsAppDisplayNumber('+62 851-8935-1510')).toBe('+62 851-8935-1510');
    expect(formatWhatsAppDisplayNumber('+62 812-3456-7890')).toBe('+62 812-3456-7890');
  });

  it('formats short international phone numbers', () => {
    expect(formatWhatsAppDisplayNumber('+1')).toBe('+1');
    expect(formatWhatsAppDisplayNumber('+12345678901')).toBe('+12 345-6789-01');
  });
});

describe('whatsapp domain helpers', () => {
  it('checks connection status', () => {
    expect(isWhatsAppConnected('CONNECTED')).toBe(true);
    expect(isWhatsAppConnected('DISCONNECTED')).toBe(false);
    expect(isWhatsAppConnected(undefined)).toBe(false);
  });

  it('converts national number to E.164', () => {
    expect(toWhatsAppE164('081234567890')).toBe('+6281234567890');
    expect(toWhatsAppE164('81234567890')).toBe('+6281234567890');
  });

  it('computes seconds until expiry', () => {
    expect(secondsUntilExpiry(null)).toBeNull();
    const future = new Date(Date.now() + 10000).toISOString();
    expect(secondsUntilExpiry(future)).toBeGreaterThanOrEqual(9);
  });

  it('classifies QR payload', () => {
    expect(classifyQrPayload(null)).toBe('empty');
    expect(classifyQrPayload('data:image/png;base64,...')).toBe('image');
    expect(classifyQrPayload('https://example.com/qr.png')).toBe('image');
    expect(classifyQrPayload('random-qr-text')).toBe('text');
  });


  it('generates deterministic avatar colors', () => {
    const color1 = conversationAvatarColor('conv-1');
    const color2 = conversationAvatarColor('conv-1');
    expect(color1).toBe(color2);
  });
});
