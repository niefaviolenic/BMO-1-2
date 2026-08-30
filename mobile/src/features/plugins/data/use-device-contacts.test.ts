/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';
import {
  _resetExpoContactsCache,
  _setExpoContactsForTesting,
  getExpoContacts,
  isNativeModuleAvailable,
  useDeviceContacts,
} from './use-device-contacts';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Linking: {
    openSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: vi.fn(),
}));

const mockContactsLegacy = {
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Name: 'name',
    FirstName: 'firstName',
    LastName: 'lastName',
  },
  SortTypes: {
    FirstName: 'firstName',
  },
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getContactsAsync: vi.fn(),
};

// Mock React hooks for testing custom hook in isolation
let hookState: Record<string, unknown> = {};
let stateSetters: Record<string, (val: unknown) => void> = {};
let hookIndex = 0;

vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const id = `state_${hookIndex++}`;
      if (!(id in hookState)) {
        hookState[id] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const setState = (newVal: unknown) => {
        hookState[id] = typeof newVal === 'function' ? (newVal as (prev: unknown) => unknown)(hookState[id]) : newVal;
      };
      stateSetters[id] = setState;
      return [hookState[id], setState];
    },
    useCallback: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

describe('use-device-contacts module & hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetExpoContactsCache();
    Platform.OS = 'ios';
    hookState = {};
    stateSetters = {};
    hookIndex = 0;
  });

  describe('isNativeModuleAvailable', () => {
    it('returns false on web', () => {
      Platform.OS = 'web';
      vi.mocked(requireOptionalNativeModule).mockReturnValue({});

      expect(isNativeModuleAvailable('ExpoContacts')).toBe(false);
      expect(requireOptionalNativeModule).not.toHaveBeenCalled();
    });

    it('returns true on native platform when native module is present', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue({});

      expect(isNativeModuleAvailable('ExpoContacts')).toBe(true);
      expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoContacts');
    });

    it('returns false on native platform when native module is missing', () => {
      Platform.OS = 'android';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      expect(isNativeModuleAvailable('ExpoContacts')).toBe(false);
      expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoContacts');
    });

    it('returns false when requireOptionalNativeModule throws an error', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockImplementation(() => {
        throw new Error('Native module initialization failure');
      });

      expect(isNativeModuleAvailable('ExpoContacts')).toBe(false);
    });
  });

  describe('getExpoContacts', () => {
    it('returns null when native module is not available and caches result', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      const firstCall = getExpoContacts();
      const secondCall = getExpoContacts();

      expect(firstCall).toBeNull();
      expect(secondCall).toBeNull();
      expect(requireOptionalNativeModule).toHaveBeenCalledTimes(1);
    });

    it('returns contacts module when set for testing', () => {
      _setExpoContactsForTesting(mockContactsLegacy as unknown as typeof ContactsType);
      const contacts = getExpoContacts();
      expect(contacts).toBeDefined();
      expect(contacts).toHaveProperty('getContactsAsync');
    });
  });

  describe('useDeviceContacts hook', () => {
    it('handles missing native module safely on loadContacts without throwing', async () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      hookIndex = 0;
      const hook = useDeviceContacts();
      await hook.loadContacts();

      hookIndex = 0;
      const updatedHook = useDeviceContacts();
      expect(updatedHook.status).toBe('denied');
      expect(updatedHook.contacts).toEqual([]);
    });

    it('handles missing native module safely on requestPermission without throwing', async () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      hookIndex = 0;
      const hook = useDeviceContacts();
      const result = await hook.requestPermission();

      expect(result).toBe(false);
      hookIndex = 0;
      const updatedHook = useDeviceContacts();
      expect(updatedHook.status).toBe('denied');
      expect(updatedHook.error).toBe('Contacts are unavailable in this environment.');
    });

    it('successfully loads and sorts contacts when permission is granted', async () => {
      _setExpoContactsForTesting(mockContactsLegacy as unknown as typeof ContactsType);
      mockContactsLegacy.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockContactsLegacy.getContactsAsync.mockResolvedValue({
        data: [
          {
            id: 'c2',
            name: 'Zoe Smith',
            phoneNumbers: [{ number: '+1234567890' }],
          },
          {
            id: 'c1',
            name: 'Alice Wonder',
            phoneNumbers: [{ number: '+1987654321' }],
          },
        ],
      });

      hookIndex = 0;
      const hook = useDeviceContacts();
      await hook.loadContacts();

      hookIndex = 0;
      const updatedHook = useDeviceContacts();
      expect(updatedHook.status).toBe('granted');
      expect(updatedHook.contacts.length).toBe(2);
      expect(updatedHook.contacts[0].name).toBe('Alice Wonder');
      expect(updatedHook.contacts[1].name).toBe('Zoe Smith');
    });

    it('requests permission if canAskAgain is true and loads contacts on grant', async () => {
      _setExpoContactsForTesting(mockContactsLegacy as unknown as typeof ContactsType);
      mockContactsLegacy.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      mockContactsLegacy.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
      });
      mockContactsLegacy.getContactsAsync.mockResolvedValue({
        data: [
          {
            id: 'c1',
            name: 'Bob Marley',
            phoneNumbers: [{ number: '+1555123456' }],
          },
        ],
      });

      hookIndex = 0;
      const hook = useDeviceContacts();
      await hook.loadContacts();

      expect(mockContactsLegacy.requestPermissionsAsync).toHaveBeenCalled();
      hookIndex = 0;
      const updatedHook = useDeviceContacts();
      expect(updatedHook.status).toBe('granted');
      expect(updatedHook.contacts.length).toBe(1);
    });

    it('sets status to denied if permission request is rejected', async () => {
      _setExpoContactsForTesting(mockContactsLegacy as unknown as typeof ContactsType);
      mockContactsLegacy.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      mockContactsLegacy.requestPermissionsAsync.mockResolvedValue({
        status: 'denied',
      });

      hookIndex = 0;
      const hook = useDeviceContacts();
      await hook.loadContacts();

      hookIndex = 0;
      const updatedHook = useDeviceContacts();
      expect(updatedHook.status).toBe('denied');
    });

    it('sets status to error when getContactsAsync throws', async () => {
      _setExpoContactsForTesting(mockContactsLegacy as unknown as typeof ContactsType);
      mockContactsLegacy.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockContactsLegacy.getContactsAsync.mockRejectedValue(new Error('Address book locked'));

      hookIndex = 0;
      const hook = useDeviceContacts();
      await hook.loadContacts();

      hookIndex = 0;
      const updatedHook = useDeviceContacts();
      expect(updatedHook.status).toBe('error');
      expect(updatedHook.error).toBe('Address book locked');
    });

    it('calls Linking.openSettings on native platforms', async () => {
      Platform.OS = 'ios';
      hookIndex = 0;
      const hook = useDeviceContacts();
      await hook.openSettings();

      expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    });
  });
});
