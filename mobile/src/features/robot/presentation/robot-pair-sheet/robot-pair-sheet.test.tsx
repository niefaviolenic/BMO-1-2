/* eslint-disable import/no-unresolved */
// @ts-ignore
import type * as ReactType from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

import { WifiNetworkItem } from './components';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactType>('react');
  return {
    ...actual,
    useState: (initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ],
    useEffect: (fn: () => void) => fn(),
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
  };
});

vi.mock('react-native', () => ({
  View: (props: unknown) => ({ type: 'View', props }),
  Text: (props: unknown) => ({ type: 'Text', props }),
  Pressable: (props: unknown) => ({ type: 'Pressable', props }),
  ScrollView: (props: unknown) => ({ type: 'ScrollView', props }),
  TextInput: (props: unknown) => ({ type: 'TextInput', props }),
  ActivityIndicator: (props: unknown) => ({ type: 'ActivityIndicator', props }),
  Animated: {
    View: (props: unknown) => ({ type: 'Animated.View', props }),
  },
  useWindowDimensions: () => ({ width: 393, height: 852 }),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Platform: {
    select: (options: { ios?: unknown; android?: unknown; default?: unknown }) =>
      options.ios ?? options.default,
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('lucide-react-native', () => ({
  Bluetooth: () => ({ type: 'Bluetooth' }),
  BluetoothOff: () => ({ type: 'BluetoothOff' }),
  Wifi: () => ({ type: 'Wifi' }),
  Lock: () => ({ type: 'Lock' }),
  Check: () => ({ type: 'Check' }),
  CheckCircle2: () => ({ type: 'CheckCircle2' }),
  AlertCircle: () => ({ type: 'AlertCircle' }),
  HelpCircle: () => ({ type: 'HelpCircle' }),
  RefreshCw: () => ({ type: 'RefreshCw' }),
  Eye: () => ({ type: 'Eye' }),
  EyeOff: () => ({ type: 'EyeOff' }),
  Signal: () => ({ type: 'Signal' }),
  ChevronRight: () => ({ type: 'ChevronRight' }),
  X: () => ({ type: 'X' }),
  ExternalLink: () => ({ type: 'ExternalLink' }),
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
    buttonPrimaryBackground: '#007AFF',
    buttonPrimaryText: '#FFFFFF',
    badgeBackground: '#EF4444',
  }),
}));

vi.mock('@/hooks/use-step-slide-transition', () => ({
  useStepSlideTransition: () => ({
    activeStep: 'scan',
    contentTranslateX: 0,
    reset: vi.fn(),
  }),
}));
vi.mock('@/features/robot/data/robot-connection-store', () => ({
  hydrateDevices: vi.fn().mockResolvedValue(undefined),
}));


vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: {
    children: unknown;
    header?: unknown;
    testID?: string;
  }) => ({
    type: 'ModalBottomSheet',
    props: {
      ...props,
      header: props.header,
    },
  }),
}));

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: () => ({ type: 'LiquidGlassBackButton' }),
}));

vi.mock('@/features/robot/presentation/camera-scan-screen/components/camera-scan-hero', () => ({
  CameraScanHero: (props: unknown) => ({ type: 'CameraScanHero', props }),
}));

vi.mock('@/features/robot/presentation/connected-success-screen/components/connected-success-hero', () => ({
  ConnectedSuccessHero: (props: unknown) => ({ type: 'ConnectedSuccessHero', props }),
}));

vi.mock('@/features/robot/data/provisioning-flow', () => ({
  provisioningManager: {
    getState: () => ({
      step: 'idle',
      isScanning: false,
      scanTimeoutReached: false,
      isWifiScanning: false,
      discoveredJoys: [],
      selectedJoy: null,
      discoveredNetworks: [],
      selectedNetwork: null,
      error: null,
    }),
    subscribe: () => () => {},
    reset: () => {},
    startScanning: () => Promise.resolve(),
    restartScanning: () => Promise.resolve(),
    selectJoy: () => Promise.resolve(),
    requestDeviceWifiScan: () => {},
    selectWifiNetwork: () => {},
    submitWifiCredentials: () => Promise.resolve(),
    clearError: () => {},
  },
}));

type MockElement = {
  type: unknown;
  props: {
    style?: unknown;
    children?: unknown;
    testID?: string;
    header?: MockElement;
    [key: string]: unknown;
  };
};


describe('Wi-Fi network selection', () => {
  it('renders WifiNetworkItem and triggers onSelect when pressed', () => {
    const onSelect = vi.fn();
    const item = WifiNetworkItem({
      network: {
        ssid: 'TestNetwork24G',
        rssi: -55,
        security: 'WPA2',
      },
      isSelected: false,
      onSelect,
      testID: 'wifi-item-test',
    }) as unknown as MockElement;

    expect(item.type).toBeDefined();
    expect(item.props.testID).toBe('wifi-item-test');
    // Invoke onPress handler
    (item.props as { onPress?: () => void }).onPress?.();
    expect(onSelect).toHaveBeenCalledWith({
      ssid: 'TestNetwork24G',
      rssi: -55,
      security: 'WPA2',
    });
  });
});
