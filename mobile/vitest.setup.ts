declare const vi: { mock: (path: string, factory: () => unknown) => void; fn: (impl?: unknown) => unknown };

if (!process.env.EXPO_OS) {
  process.env.EXPO_OS = 'ios';
}

if (typeof globalThis.expo === 'undefined') {
  (globalThis as any).expo = {
    EventEmitter: class EventEmitter {
      addListener() {
        return { remove: () => {} };
      }
      removeListener() {}
      emit() {}
      removeAllListeners() {}
    },
  };
}

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: vi.fn(() => null),
  requireNativeModule: vi.fn(() => null),
}));
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#0D0D0D',
    textSecondary: '#666666',
    textMuted: '#999999',
    cardBackground: '#FFFFFF',
    cardBackgroundSubtle: '#F7F7F8',
    border: '#E5E5EA',
    linkPrimary: '#007AFF',
    accentPrimary: '#007AFF',
    accentDot: '#007AFF',
    buttonPrimaryBackground: '#007AFF',
    buttonPrimaryText: '#FFFFFF',
    badgeBackground: '#EF4444',
  }),
}));
vi.mock('react-native-ble-plx', () => {
  return {
    BleManager: class MockBleManager {
      startDeviceScan = vi.fn((_uuid: unknown, _opts: unknown, _cb: unknown) => {});
      stopDeviceScan = vi.fn(() => {});
      connectToDevice = vi.fn(async () => ({
        discoverAllServicesAndCharacteristics: vi.fn(async () => ({
          requestMTU: vi.fn(async () => ({})),
          readCharacteristicForService: vi.fn(async () => ({ value: 'e30=' })),
          writeCharacteristicWithResponseForService: vi.fn(async () => ({})),
          monitorCharacteristicForService: vi.fn(() => ({ remove: vi.fn() })),
          cancelConnection: vi.fn(async () => {}),
        })),
      }));
    },
  };
});

