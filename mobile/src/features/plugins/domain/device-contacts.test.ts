/* eslint-disable import/no-unresolved */
// @ts-ignore
import { describe, expect, it } from 'vitest';

import {
  createDeviceContact,
  filterDeviceContacts,
  normalizePhoneNumber,
} from './device-contacts';

describe('normalizePhoneNumber', () => {
  it('handles standard indonesian numbers starting with 0', () => {
    expect(normalizePhoneNumber('08123456789')).toBe('+628123456789');
    expect(normalizePhoneNumber('0857-1234-5678')).toBe('+6285712345678');
    expect(normalizePhoneNumber('0812 3456 7890')).toBe('+6281234567890');
  });

  it('handles numbers already with + prefix', () => {
    expect(normalizePhoneNumber('+628123456789')).toBe('+628123456789');
    expect(normalizePhoneNumber('+62 812-3456-7890')).toBe('+6281234567890');
    expect(normalizePhoneNumber('+1 (415) 555-2671')).toBe('+14155552671');
    expect(normalizePhoneNumber('+65 9123 4567')).toBe('+6591234567');
  });

  it('handles numbers starting with 62 without +', () => {
    expect(normalizePhoneNumber('628123456789')).toBe('+628123456789');
  });

  it('handles numbers starting with 8 without 0 or +62', () => {
    expect(normalizePhoneNumber('8123456789')).toBe('+628123456789');
  });

  it('returns empty string for invalid or empty input', () => {
    expect(normalizePhoneNumber('')).toBe('');
    expect(normalizePhoneNumber('   ')).toBe('');
    expect(normalizePhoneNumber('abc')).toBe('');
  });
});

describe('createDeviceContact', () => {
  it('creates contact and extracts valid phone numbers', () => {
    const contact = createDeviceContact('1', 'Budi Santoso', [
      { number: '08123456789', label: 'mobile' },
      { number: '021-5551234', label: 'work' },
    ]);

    expect(contact).not.toBeNull();
    expect(contact?.id).toBe('1');
    expect(contact?.name).toBe('Budi Santoso');
    expect(contact?.phoneNumber).toBe('08123456789');
    expect(contact?.normalizedPhoneNumber).toBe('+628123456789');
    expect(contact?.phoneNumbers).toHaveLength(2);
  });

  it('returns null if contact has no valid phone numbers', () => {
    const contact = createDeviceContact('2', 'No Phone', []);
    expect(contact).toBeNull();
  });
});

describe('filterDeviceContacts', () => {
  const contacts = [
    {
      id: '1',
      name: 'Budi Santoso',
      phoneNumber: '08123456789',
      normalizedPhoneNumber: '+628123456789',
      phoneNumbers: [{ number: '08123456789', normalizedNumber: '+628123456789' }],
      avatarColor: '#E56666',
    },
    {
      id: '2',
      name: 'Cenna Wijaya',
      phoneNumber: '08571234567',
      normalizedPhoneNumber: '+628571234567',
      phoneNumbers: [{ number: '08571234567', normalizedNumber: '+628571234567' }],
      avatarColor: '#4D99E5',
    },
  ];

  it('returns all contacts when query is empty', () => {
    expect(filterDeviceContacts(contacts, '')).toHaveLength(2);
    expect(filterDeviceContacts(contacts, '   ')).toHaveLength(2);
  });

  it('filters by name case-insensitively', () => {
    const result = filterDeviceContacts(contacts, 'cenna');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cenna Wijaya');
  });

  it('filters by phone number digits', () => {
    const result = filterDeviceContacts(contacts, '857');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cenna Wijaya');
  });
});
