import * as Contacts from 'expo-contacts/legacy';
import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';

import {
  createDeviceContact,
  type DeviceContact,
} from '../domain/device-contacts';

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
