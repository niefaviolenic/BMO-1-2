import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPlatform, mockPermissionsAndroid } = vi.hoisted(() => {
  return {
    mockPlatform: {
      OS: 'ios',
      Version: 33 as number | string,
      select: vi.fn((dict: Record<string, unknown>) => dict.ios ?? dict.default),
    },
    mockPermissionsAndroid: {
      PERMISSIONS: {
        BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
        BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
        ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      },
      RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        NEVER_ASK_AGAIN: 'never_ask_again',
      },
      requestMultiple: vi.fn(),
      request: vi.fn(),
    },
  };
});

vi.mock('react-native', () => ({
  Platform: mockPlatform,
  PermissionsAndroid: mockPermissionsAndroid,
}));

import { BleTransportClient, requestBlePermissions } from './ble-transport';

describe('requestBlePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true on non-Android platforms without requesting permissions', async () => {
    mockPlatform.OS = 'ios';
    const result = await requestBlePermissions();
    expect(result).toBe(true);
    expect(mockPermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    expect(mockPermissionsAndroid.request).not.toHaveBeenCalled();
  });

  it('requests BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and ACCESS_FINE_LOCATION on Android >= 31', async () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = 33;

    mockPermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: mockPermissionsAndroid.RESULTS.GRANTED,
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: mockPermissionsAndroid.RESULTS.GRANTED,
      [mockPermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: mockPermissionsAndroid.RESULTS.GRANTED,
    });

    const result = await requestBlePermissions();
    expect(result).toBe(true);
    expect(mockPermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      mockPermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
  });

  it('returns false on Android >= 31 if BLUETOOTH_SCAN is denied', async () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = 31;

    mockPermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: mockPermissionsAndroid.RESULTS.DENIED,
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: mockPermissionsAndroid.RESULTS.GRANTED,
      [mockPermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: mockPermissionsAndroid.RESULTS.GRANTED,
    });

    const result = await requestBlePermissions();
    expect(result).toBe(false);
  });

  it('returns false on Android >= 31 if BLUETOOTH_CONNECT is denied', async () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = '34';

    mockPermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: mockPermissionsAndroid.RESULTS.GRANTED,
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: mockPermissionsAndroid.RESULTS.DENIED,
      [mockPermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: mockPermissionsAndroid.RESULTS.GRANTED,
    });

    const result = await requestBlePermissions();
    expect(result).toBe(false);
  });

  it('requests ACCESS_FINE_LOCATION on Android < 31 and returns true when granted', async () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = 29;

    mockPermissionsAndroid.request.mockResolvedValueOnce(mockPermissionsAndroid.RESULTS.GRANTED);

    const result = await requestBlePermissions();
    expect(result).toBe(true);
    expect(mockPermissionsAndroid.request).toHaveBeenCalledWith(
      mockPermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
  });

  it('returns false on Android < 31 when ACCESS_FINE_LOCATION is denied', async () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = '28';

    mockPermissionsAndroid.request.mockResolvedValueOnce(mockPermissionsAndroid.RESULTS.DENIED);

    const result = await requestBlePermissions();
    expect(result).toBe(false);
  });
});

describe('BleTransportClient.startScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts scan and logs warning when permissions are not granted', async () => {
    mockPlatform.OS = 'android';
    mockPlatform.Version = 33;
    mockPermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: mockPermissionsAndroid.RESULTS.DENIED,
      [mockPermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: mockPermissionsAndroid.RESULTS.DENIED,
      [mockPermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: mockPermissionsAndroid.RESULTS.DENIED,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = new BleTransportClient();
    const onDiscovered = vi.fn();

    await client.startScan(onDiscovered);

    expect(warnSpy).toHaveBeenCalledWith('[BLE] Bluetooth permissions not granted');
    warnSpy.mockRestore();
  });

  it('proceeds with scan when permissions are granted', async () => {
    mockPlatform.OS = 'ios';
    const client = new BleTransportClient();
    const onDiscovered = vi.fn();

    await client.startScan(onDiscovered);
  });
});
