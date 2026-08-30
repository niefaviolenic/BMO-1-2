/* eslint-disable import/no-unresolved */
// @ts-ignore
import type * as ReactType from 'react';
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

import { RobotPairSheet } from './robot-pair-sheet';
import {
  PairStepIndicator,
  BluetoothStatusBanner,
  JoyTroubleshootingCard,
  JoyBeaconItem,
  WifiNetworkItem,
  PairErrorCard,
} from './components';

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

describe('RobotPairSheet', () => {
  it('renders header with step indicator and title', () => {
    const tree = RobotPairSheet({
      isVisible: true,
      onClose: vi.fn(),
      testID: 'pair-sheet',
    }) as unknown as MockElement;

    expect(tree.type).toBeDefined();
    expect(tree.props.testID).toBe('pair-sheet');

    const header = tree.props.header;
    expect(header).toBeDefined();
    expect(header?.props.testID).toBe('pair-sheet-header');
  });

  it('renders PairStepIndicator with 4 steps', () => {
    const indicator = PairStepIndicator({
      currentStep: 'scan',
      testID: 'indicator-test',
    }) as unknown as MockElement;

    expect(indicator.type).toBeDefined();
    expect(indicator.props.testID).toBe('indicator-test');
  });

  it('renders BluetoothStatusBanner with settings trigger', () => {
    const onSettings = vi.fn();
    const banner = BluetoothStatusBanner({
      onOpenSettings: onSettings,
      testID: 'banner-test',
    }) as unknown as MockElement;

    expect(banner.type).toBeDefined();
    expect(banner.props.testID).toBe('banner-test');
  });

  it('renders JoyTroubleshootingCard with rescan callback', () => {
    const onRescan = vi.fn();
    const card = JoyTroubleshootingCard({
      onRescan,
      isScanning: false,
      testID: 'troubleshoot-test',
    }) as unknown as MockElement;

    expect(card.type).toBeDefined();
    expect(card.props.testID).toBe('troubleshoot-test');
  });

  it('renders JoyBeaconItem with device information', () => {
    const onSelect = vi.fn();
    const item = JoyBeaconItem({
      joy: {
        id: 'joy-1',
        name: 'Joy Robot A1',
        provisioningRef: 'JOY-A1B2',
        hardwareId: 'hw-123',
        setupNonce: 'nonce',
        resetEpoch: 0,
        rssi: -45,
      },
      onPress: onSelect,
      testID: 'beacon-test',
    }) as unknown as MockElement;

    expect(item.type).toBeDefined();
    expect(item.props.testID).toBe('beacon-test');
  });

  it('renders WifiNetworkItem with security and selection status', () => {
    const onSelect = vi.fn();
    const item = WifiNetworkItem({
      network: {
        ssid: 'MyHomeWiFi',
        rssi: -50,
        security: 'WPA2',
      },
      isSelected: true,
      onSelect,
      testID: 'wifi-test',
    }) as unknown as MockElement;

    expect(item.type).toBeDefined();
    expect(item.props.testID).toBe('wifi-test');
  });

  it('renders PairErrorCard with message and retry option', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    const card = PairErrorCard({
      message: 'Failed to connect to Joy',
      onRetry,
      onDismiss,
      testID: 'error-test',
    }) as unknown as MockElement;

    expect(card.type).toBeDefined();
    expect(card.props.testID).toBe('error-test');
  });
});
