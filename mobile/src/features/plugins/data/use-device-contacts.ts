import type * as ContactsType from 'expo-contacts/legacy';
import { requireOptionalNativeModule } from 'expo';
import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';
import {
  createDeviceContact,
  type DeviceContact,
} from '../domain/device-contacts';

export function isNativeModuleAvailable(moduleName: string): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    return requireOptionalNativeModule(moduleName) !== null;
  } catch {
    return false;
  }
}

let cachedExpoContacts: typeof ContactsType | null | undefined = undefined;

export function _resetExpoContactsCache(): void {
  cachedExpoContacts = undefined;
}

export function _setExpoContactsForTesting(
  module: typeof ContactsType | null | undefined,
): void {
  cachedExpoContacts = module;
}

export function getExpoContacts(): typeof ContactsType | null {
  if (cachedExpoContacts !== undefined) {
    return cachedExpoContacts;
  }
  if (!isNativeModuleAvailable('ExpoContacts')) {
    cachedExpoContacts = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedExpoContacts = require('expo-contacts/legacy') as typeof ContactsType;
  } catch {
    cachedExpoContacts = null;
  }
  return cachedExpoContacts;
}

export type DeviceContactsStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'error';

export type UseDeviceContactsResult = {
  contacts: DeviceContact[];
  status: DeviceContactsStatus;
  isLoading: boolean;
  permissionGranted: boolean;
  error: string | null;
  loadContacts: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
};

export function useDeviceContacts(): UseDeviceContactsResult {
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [status, setStatus] = useState<DeviceContactsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchContactsData = useCallback(async () => {
    const Contacts = getExpoContacts();
    if (!Contacts) {
      setStatus('denied');
      setError('Contacts are unavailable in this environment.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      const parsedContacts: DeviceContact[] = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          const rawNumbers = item.phoneNumbers ?? [];
          const contact = createDeviceContact(
            item.id ?? Math.random().toString(),
            item.name ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim(),
            rawNumbers,
          );
          if (contact) {
            parsedContacts.push(contact);
          }
        }
      }

      // Sort alphabetically by contact name
      parsedContacts.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );

      setContacts(parsedContacts);
      setStatus('granted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to access contacts.';
      setError(message);
      setStatus('error');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const Contacts = getExpoContacts();
    if (!Contacts) {
      setStatus('denied');
      setError('Contacts are unavailable in this environment.');
      return false;
    }
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await fetchContactsData();
        return true;
      }
      setStatus('denied');
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission request failed.';
      setError(message);
      setStatus('error');
      return false;
    }
  }, [fetchContactsData]);

  const loadContacts = useCallback(async () => {
    const Contacts = getExpoContacts();
    if (!Contacts) {
      setStatus('denied');
      return;
    }
    try {
      const permission = await Contacts.getPermissionsAsync();
      if (permission.status === 'granted') {
        await fetchContactsData();
        return;
      }

      if (permission.canAskAgain) {
        await requestPermission();
        return;
      }

      setStatus('denied');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check permissions.';
      setError(message);
      setStatus('error');
    }
  }, [fetchContactsData, requestPermission]);

  const openSettings = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Linking.openSettings().catch(() => undefined);
    }
  }, []);

  return {
    contacts,
    status,
    isLoading: status === 'loading',
    permissionGranted: status === 'granted',
    error,
    loadContacts,
    requestPermission,
    openSettings,
  };
}
