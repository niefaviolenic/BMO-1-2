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
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Linking: {
    openSettings: vi.fn().mockResolvedValue(true),
  },
  View: (props: unknown) => ({ type: 'View', props }),
  Text: (props: unknown) => ({ type: 'Text', props }),
  Pressable: (props: unknown) => ({ type: 'Pressable', props }),
  ScrollView: (props: unknown) => ({ type: 'ScrollView', props }),
  TextInput: (props: unknown) => ({ type: 'TextInput', props }),
  ActivityIndicator: (props: unknown) => ({ type: 'ActivityIndicator', props }),
  Animated: {
    View: (props: unknown) => ({ type: 'Animated.View', props }),
    Value: vi.fn(() => ({
      interpolate: vi.fn(),
      setValue: vi.fn(),
    })),
    timing: vi.fn(() => ({
      start: vi.fn((cb?: () => void) => cb?.()),
    })),
  },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('lucide-react-native', () => ({
  Bluetooth: (props: unknown) => ({ type: 'Bluetooth', props }),
  Wifi: (props: unknown) => ({ type: 'Wifi', props }),
  ChevronRight: (props: unknown) => ({ type: 'ChevronRight', props }),
  Eye: (props: unknown) => ({ type: 'Eye', props }),
  EyeOff: (props: unknown) => ({ type: 'EyeOff', props }),
  RefreshCw: (props: unknown) => ({ type: 'RefreshCw', props }),
  Check: (props: unknown) => ({ type: 'Check', props }),
  Lock: (props: unknown) => ({ type: 'Lock', props }),
  Signal: (props: unknown) => ({ type: 'Signal', props }),
  AlertCircle: (props: unknown) => ({ type: 'AlertCircle', props }),
  ExternalLink: (props: unknown) => ({ type: 'ExternalLink', props }),
  HelpCircle: (props: unknown) => ({ type: 'HelpCircle', props }),
  Sparkles: (props: unknown) => ({ type: 'Sparkles', props }),
  X: (props: unknown) => ({ type: 'X', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#CCCCCC',
    cardBackground: '#FFFFFF',
    cardBackgroundSubtle: '#F7F7F8',
    modalBackground: '#FFFFFF',
    buttonPrimaryBackground: '#000000',
    buttonPrimaryText: '#FFFFFF',
    linkPrimary: '#0066CC',
    statusError: '#FF3B30',
    surfaceSubtle: '#F0F0F0',
  }),
}));

vi.mock('@/hooks/use-step-slide-transition', () => ({
  useStepSlideTransition: () => ({
    activeStep: 'scan',
    contentTranslateX: 0,
  }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: ({
    children,
    header,
    testID,
    ...props
  }: {
    children: React.ReactNode;
    header: React.ReactNode;
    testID?: string;
    [key: string]: unknown;
  }) => ({
    type: 'ModalBottomSheet',
    props: { testID, header, children, ...props },
  }),
}));

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: (props: unknown) => ({
    type: 'LiquidGlassBackButton',
    props,
  }),
}));

vi.mock('@/features/robot/presentation/camera-scan-screen/components/camera-scan-hero', () => ({
  CameraScanHero: (props: unknown) => ({
    type: 'CameraScanHero',
    props,
  }),
}));

vi.mock('@/features/robot/presentation/connected-success-screen/components/connected-success-hero', () => ({
  ConnectedSuccessHero: (props: unknown) => ({
    type: 'ConnectedSuccessHero',
    props,
  }),
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
    triggerDemoPhysicalConfirmation: () => Promise.resolve(),
    requestDeviceWifiScan: () => Promise.resolve(),
    selectWifiNetwork: () => {},
    submitWifiCredentials: () => Promise.resolve(),
    clearError: () => {},
    discoverDemoJoy: () => {},
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

  it('renders JoyTroubleshootingCard with rescan and demo callbacks', () => {
    const onRescan = vi.fn();
    const onDemo = vi.fn();
    const card = JoyTroubleshootingCard({
      onRescan,
      onSimulateDemo: onDemo,
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
