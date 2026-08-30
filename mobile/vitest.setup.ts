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

