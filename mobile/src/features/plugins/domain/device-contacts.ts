import { conversationAvatarColor } from './whatsapp';

export type DevicePhoneNumber = {
  id?: string;
  number: string;
  label?: string;
  normalizedNumber: string;
};

export type DeviceContact = {
  id: string;
  name: string;
  phoneNumber: string;
  normalizedPhoneNumber: string;
  phoneNumbers: DevicePhoneNumber[];
  avatarColor: string;
};

/**
 * Normalizes a raw phone string into standard E.164 (+<country_code><number>)
 * Defaults to Indonesia (+62) if no country code is present.
 */
export function normalizePhoneNumber(
  rawNumber: string,
  defaultCountryCallingCode = '62',
): string {
  const trimmed = rawNumber.trim();
  if (!trimmed) {
    return '';
  }

  // If already starts with '+', keep '+' and strip all non-digits
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  // If starts with '0', replace with default country calling code (e.g. 0812 -> +62812)
  if (digits.startsWith('0')) {
    return `+${defaultCountryCallingCode}${digits.slice(1)}`;
  }

  // If starts with default calling code (e.g. 62812 -> +62812)
  if (digits.startsWith(defaultCountryCallingCode)) {
    return `+${digits}`;
  }

  // If starts with national mobile prefix without 0 (e.g. 812 -> +62812)
  if (defaultCountryCallingCode === '62' && digits.startsWith('8')) {
    return `+62${digits}`;
  }

  // Fallback prefix with default country calling code
  return `+${defaultCountryCallingCode}${digits}`;
}

export function filterDeviceContacts(
  contacts: DeviceContact[],
  query: string,
): DeviceContact[] {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return contacts;
  }

  const digitsOnlyQuery = trimmedQuery.replace(/\D/g, '');

  return contacts.filter((contact) => {
    // Match by name
    if (contact.name.toLowerCase().includes(trimmedQuery)) {
      return true;
    }

    // Match by phone number strings or digits
    if (contact.phoneNumber.toLowerCase().includes(trimmedQuery)) {
      return true;
    }
    if (contact.normalizedPhoneNumber.includes(trimmedQuery)) {
      return true;
    }

    if (digitsOnlyQuery) {
      if (contact.normalizedPhoneNumber.replace(/\D/g, '').includes(digitsOnlyQuery)) {
        return true;
      }
      return contact.phoneNumbers.some((phone) =>
        phone.normalizedNumber.replace(/\D/g, '').includes(digitsOnlyQuery),
      );
    }

    return false;
  });
}

export function createDeviceContact(
  id: string,
  name: string,
  rawNumbers: { id?: string; number?: string; label?: string }[],
): DeviceContact | null {
  const validNumbers: DevicePhoneNumber[] = [];

  for (const item of rawNumbers) {
    const number = item.number?.trim() ?? '';
    if (!number) {
      continue;
    }
    const normalizedNumber = normalizePhoneNumber(number);
    if (normalizedNumber.length > 0) {
      validNumbers.push({
        id: item.id,
        number,
        label: item.label,
        normalizedNumber,
      });
    }
  }

  if (validNumbers.length === 0) {
    return null;
  }

  const primary = validNumbers[0];
  const displayName = name.trim() || primary.number;

  return {
    id,
    name: displayName,
    phoneNumber: primary.number,
    normalizedPhoneNumber: primary.normalizedNumber,
    phoneNumbers: validNumbers,
    avatarColor: conversationAvatarColor(id || displayName),
  };
}
