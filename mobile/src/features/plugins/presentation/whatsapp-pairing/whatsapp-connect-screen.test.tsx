/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QRCodeDisplayBox } from './components/qr-code-display-box';
import { WhatsAppConnectScreen } from './whatsapp-connect-screen';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};

// --- Mock state holders ---
let mockRobotConnection: {
  status: string;
  device: any;
  isHydrating: boolean;
  isPairing: boolean;
  isUnpairing: boolean;
  error: null | string;
} = {
  status: 'disconnected',
  device: null,
  isHydrating: false,
  isPairing: false,
  isUnpairing: false,
  error: null,
};

let mockWhatsAppSession = {
  connection: null as { status: string } | null,
  pairing: null,
  qr: { qr: '2@mock-qr-code-payload', expiresAt: new Date(Date.now() + 60000).toISOString() } as {
    qr: string | null;
    expiresAt: string | null;
  } | null,
  rules: [],
  conversations: [],
  isConnecting: false,
  isLoadingRules: false,
  error: null,
};

const mockStartWhatsAppConnect = vi.fn().mockResolvedValue({ connection: { status: 'DISCONNECTED' } });
const mockStopWhatsAppConnectPolling = vi.fn();
const mockHydrateWhatsAppSession = vi.fn().mockResolvedValue(undefined);
const mockConfirmWhatsAppPairing = vi.fn().mockResolvedValue({ status: 'CONNECTED' });
const mockGetWhatsAppSessionState = vi.fn(() => mockWhatsAppSession);

vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    useRef: vi.fn((initial?: unknown) => ({ current: initial })),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useMemo: vi.fn((factory: () => unknown) => factory()),
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

let mockAppStateChangeCallback: ((state: string) => void) | null = null;
const mockAppStateRemove = vi.fn();

vi.mock('react-native', () => ({
  ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
  Alert: { alert: vi.fn() },
  Animated: {
    View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
    Value: vi.fn(() => ({
      setValue: vi.fn(),
      interpolate: vi.fn(() => 0),
    })),
    timing: vi.fn(() => ({ start: (cb?: () => void) => cb?.() })),
  },
  AppState: {
    addEventListener: vi.fn((event: string, callback: (state: string) => void) => {
      if (event === 'change') {
        mockAppStateChangeCallback = callback;
      }
      return { remove: mockAppStateRemove };
    }),
    currentState: 'active',
  },
  Linking: {
    canOpenURL: vi.fn().mockResolvedValue(true),
    openURL: vi.fn().mockResolvedValue(true),
  },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  ScrollView: (props: MockComponentProps) => ({ type: 'ScrollView', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: () => true,
  }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('react-native-qrcode-svg', () => ({
  default: (props: MockComponentProps) => ({ type: 'QRCode', props }),
}));

vi.mock('lucide-react-native', () => ({
  RefreshCw: (props: MockComponentProps) => ({ type: 'RefreshCw', props }),
  ExternalLink: (props: MockComponentProps) => ({ type: 'ExternalLink', props }),
  ChevronLeft: (props: MockComponentProps) => ({ type: 'ChevronLeft', props }),
}));

vi.mock('@/constants/theme', () => ({
  Colors: { light: {}, dark: {} },
  QRCodeDisplayBoxTokens: {
    colors: {
      cardBackground: '#FFFFFF',
      cardBorder: '#E3E8F0',
      headerLabel: '#64748B',
      timerBadgeBackground: '#FCF2F2',
      timerBadgeBorder: '#FAD1D1',
      timerBadgeText: '#DB2626',
      qrBoxBackground: '#F7FAFC',
      qrBoxBorder: '#E3E8F0',
      qrPlaceholderFill: '#0F1729',
      qrPlaceholderInset: '#FFFFFF',
      mirrorBadgeBackground: '#F0FDF4',
      mirrorBadgeBorder: '#BBF7D0',
      mirrorBadgeText: '#15803D',
      mirrorDot: '#22C55E',
    },
    layout: {
      width: 354,
      height: 260,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      qrSize: 180,
    },
    header: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.3,
      rowHeight: 24,
    },
    mirrorBadge: {
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.2,
      dotSize: 6,
    },
    timerBadge: {
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 10,
      fontWeight: '600',
    },
    qrBox: {
      borderRadius: 12,
      borderWidth: 1,
      finderOuterSize: 40,
      finderOuterRadius: 6,
      finderMidSize: 26,
      finderMidRadius: 4,
      finderInnerSize: 14,
      finderInnerRadius: 2,
      finderInset: 15,
      moduleSize: 10,
      moduleRadius: 2,
    },
  },
  WhatsAppConnectScreenTokens: {
    layout: {
      sectionWidth: 354,
      horizontalPadding: 18,
      headerHeight: 44,
      headerMarginBottom: 16,
      headerButtonSize: 40,
      contentGapPairing: 20,
      contentGapSuccess: 24,
      scrollBottomExtra: 24,
      floatingPaddingTop: 16,
      floatingPaddingBottomMin: 16,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      paddingHorizontal: 8,
    },
    colors: {
      background: '#FFFFFF',
      headerTitle: '#0F1729',
      primaryButton: '#18181B',
      primaryButtonText: '#FFFFFF',
      toggleLink: '#0F1729',
    },
    slide: {
      duration: 260,
    },
    primaryButton: {
      height: 52,
      borderRadius: 14,
      fontSize: 15,
      fontWeight: '600',
      gap: 12,
      pressedOpacity: 0.85,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    toggleLink: {
      fontSize: 14,
      fontWeight: '600',
      pressedOpacity: 0.6,
    },
  },
}));

vi.mock('@/features/plugins/domain/whatsapp', () => ({
  DEFAULT_WHATSAPP_QR_TTL_SECONDS: 25,
  classifyQrPayload: (qr: string | null) => {
    if (!qr || qr.trim().length === 0) return 'empty';
    if (qr.startsWith('data:image')) return 'image';
    return 'text';
  },
  isWhatsAppConnected: (status: string | undefined) => status === 'CONNECTED',
  secondsUntilExpiry: (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const deltaMs = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(deltaMs)) return null;
    return Math.max(0, Math.floor(deltaMs / 1000));
  },
  toWhatsAppLinkedDevicesUrl: (qr: string | null) => (qr ? `https://wa.me/settings/linked_devices#${qr}` : null),
}));

vi.mock('@/features/plugins/domain/plugin', () => ({
  mapPluginApiError: (err: unknown) => (err instanceof Error ? err.message : 'Error'),
}));

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: (props: MockComponentProps) => ({ type: 'LiquidGlassBackButton', props }),
}));

vi.mock('@/features/robot/data/use-robot-connection', () => ({
  useRobotConnection: () => mockRobotConnection,
}));
vi.mock('@/features/plugins/data/use-whatsapp-session', () => ({
  useWhatsAppSession: () => mockWhatsAppSession,
}));

vi.mock('@/features/plugins/data/whatsapp-session-store', () => ({
  startWhatsAppConnect: () => mockStartWhatsAppConnect(),
  stopWhatsAppConnectPolling: () => mockStopWhatsAppConnectPolling(),
  dismissWhatsAppSessionQr: vi.fn().mockResolvedValue(undefined),
  hydrateWhatsAppSession: () => mockHydrateWhatsAppSession(),
  confirmWhatsAppPairing: () => mockConfirmWhatsAppPairing(),
  getWhatsAppSessionState: () => mockGetWhatsAppSessionState(),
}));

vi.mock('@/hooks/use-step-slide-transition', () => ({
  useStepSlideTransition: ({ currentStep }: { currentStep: string }) => ({
    activeStep: currentStep,
    contentTranslateX: 0,
  }),
}));

vi.mock('@/features/plugins/presentation/whatsapp-pairing/components', async () => {
  const qrModule = await import('./components/qr-code-display-box');
  return {
    ActiveJoyCapabilitiesCard: (props: MockComponentProps) => ({ type: 'ActiveJoyCapabilitiesCard', props }),
    PairingInstructionsCard: (props: MockComponentProps) => ({ type: 'PairingInstructionsCard', props }),
    PairingSuccessHero: (props: MockComponentProps) => ({ type: 'PairingSuccessHero', props }),
    QRPairingHero: (props: MockComponentProps) => ({ type: 'QRPairingHero', props }),
    QRCodeDisplayBox: qrModule.QRCodeDisplayBox,
  };
});

function findComponentByTestId(node: any, testID: string): any {
  if (!node) return null;
  if (node.props?.testID === testID) return node;
  const children = React.Children.toArray(node.props?.children);
  for (const child of children) {
    const found = findComponentByTestId(child, testID);
    if (found) return found;
  }
  return null;
}

describe('QRCodeDisplayBox Component', () => {
  it('renders MIRRORED TO JOY ROBOT badge when robotSync is online and QR is present', () => {
    const element = QRCodeDisplayBox({
      qrValue: '2@mock-qr-code-payload',
      robotSync: { online: true, name: 'Joy Robot' },
      testID: 'qr-box',
    });

    expect(element.props.testID).toBe('qr-box');
    const mirrorBadge = findComponentByTestId(element, 'qr-box-mirror-badge');

    expect(mirrorBadge).toBeDefined();
    expect(mirrorBadge.props.accessibilityLabel).toBe(
      'QR code is also displayed on your Joy Robot screen'
    );
    expect(mirrorBadge.props.children[1].props.children).toBe('MIRRORED TO JOY ROBOT');
  });

  it('renders custom robot name in mirror badge when provided', () => {
    const element = QRCodeDisplayBox({
      qrValue: '2@mock-qr-code-payload',
      robotSync: { online: true, name: 'Joy Desk Robot' },
      testID: 'qr-box',
    });

    const mirrorBadge = findComponentByTestId(element, 'qr-box-mirror-badge');

    expect(mirrorBadge).toBeDefined();
    expect(mirrorBadge.props.accessibilityLabel).toBe(
      'QR code is also displayed on your Joy Desk Robot screen'
    );
    expect(mirrorBadge.props.children[1].props.children).toBe('MIRRORED TO JOY DESK ROBOT');
  });

  it('does NOT render mirror badge when robot is offline or disconnected', () => {
    const element = QRCodeDisplayBox({
      qrValue: '2@mock-qr-code-payload',
      robotSync: { online: false, name: 'Joy Robot' },
      testID: 'qr-box',
    });

    const mirrorBadge = findComponentByTestId(element, 'qr-box-mirror-badge');
    expect(mirrorBadge).toBeNull();
  });

  it('does NOT render mirror badge when qrValue is empty even if robot is online', () => {
    const element = QRCodeDisplayBox({
      qrValue: null,
      robotSync: { online: true, name: 'Joy Robot' },
      testID: 'qr-box',
    });

    const mirrorBadge = findComponentByTestId(element, 'qr-box-mirror-badge');
    expect(mirrorBadge).toBeNull();
  });

  it('renders EXPIRED badge and reload overlay when isExpired is true', () => {
    const onRefreshMock = vi.fn();
    const element = QRCodeDisplayBox({
      qrValue: '2@mock-qr-code-payload',
      isExpired: true,
      onRefresh: onRefreshMock,
      testID: 'qr-box',
    });

    const timerBadge = findComponentByTestId(element, 'qr-box-timer-badge');
    expect(timerBadge).toBeDefined();
    expect(timerBadge.props.children.props.children).toBe('EXPIRED');

    const overlay = findComponentByTestId(element, 'qr-box-expired-overlay');
    expect(overlay).toBeDefined();

    overlay.props.onPress();
    expect(onRefreshMock).toHaveBeenCalledTimes(1);
  });
});

describe('WhatsAppConnectScreen Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRobotConnection = {
      status: 'disconnected',
      device: null,
      isHydrating: false,
      isPairing: false,
      isUnpairing: false,
      error: null,
    };
    mockWhatsAppSession = {
      connection: null,
      pairing: null,
      qr: { qr: '2@mock-qr-code-payload', expiresAt: new Date(Date.now() + 60000).toISOString() },
      rules: [],
      conversations: [],
      isConnecting: false,
      isLoadingRules: false,
      error: null,
    };
  });

  it('passes robotSync and updates step 3 instructions when robot is connected and online', () => {
    mockRobotConnection = {
      status: 'connected',
      device: {
        id: 'dev-1',
        hardwareId: 'BMO-1-2',
        name: 'Joy Desk Robot',
        status: 'ACTIVE',
        pairedAt: null,
        lastSeenAt: null,
        online: true,
        batteryPercent: 80,
        wifiConnected: true,
        wifiStatus: 'WiFi Active',
        statusLabel: 'Online',
      },
      isHydrating: false,
      isPairing: false,
      isUnpairing: false,
      error: null,
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    expect(element.props.testID).toBe('whatsapp-connect');

    const qrBox = findComponentByTestId(element, 'whatsapp-connect-qr-box');
    expect(qrBox).toBeDefined();
    expect(qrBox.props.robotSync).toEqual({ online: true, name: 'Joy Desk Robot' });

    const instructions = findComponentByTestId(element, 'whatsapp-connect-qr-instructions');
    expect(instructions).toBeDefined();
    const steps = instructions.props.steps;
    expect(steps).toHaveLength(3);
    expect(steps[2].title).toBe('Scan the QR on Joy Robot');
    expect(steps[2].description).toBe(
      "If WhatsApp is on this phone, point your WhatsApp Linked Devices camera at your Joy Robot's screen."
    );
  });

  it('renders standard fallback step 3 instructions when no robot is paired or offline', () => {
    mockRobotConnection = {
      status: 'disconnected',
      device: null,
      isHydrating: false,
      isPairing: false,
      isUnpairing: false,
      error: null,
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });

    const qrBox = findComponentByTestId(element, 'whatsapp-connect-qr-box');
    expect(qrBox).toBeDefined();
    expect(qrBox.props.robotSync).toEqual({ online: false, name: 'Joy Robot' });

    const instructions = findComponentByTestId(element, 'whatsapp-connect-qr-instructions');
    expect(instructions).toBeDefined();
    const steps = instructions.props.steps;
    expect(steps).toHaveLength(3);
    expect(steps[2].title).toBe('Or scan the QR');
    expect(steps[2].description).toBe('If WhatsApp is on another phone, scan the code above.');
  });

  it('shows requesting label when session is connecting', () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      isConnecting: true,
      qr: null,
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });

    const qrBox = findComponentByTestId(element, 'whatsapp-connect-qr-box');
    expect(qrBox.props.waitingLabel).toBe('Requesting WhatsApp QR…');
  });

  it('renders Reload QR Code CTA button when QR is expired', () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      qr: {
        qr: '2@mock-qr-code-payload',
        expiresAt: new Date(Date.now() - 5000).toISOString(),
      },
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });

    const reloadButton = findComponentByTestId(element, 'whatsapp-connect-reload-qr-cta-button');
    expect(reloadButton).toBeDefined();
    expect(reloadButton.props.accessibilityLabel).toBe('Reload QR Code');

    reloadButton.props.onPress();
    expect(mockStartWhatsAppConnect).toHaveBeenCalled();
  });

  it('subscribes to AppState changes and refreshes session on active', () => {
    WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    expect(mockAppStateChangeCallback).toBeDefined();

    if (mockAppStateChangeCallback) {
      mockAppStateChangeCallback('active');
      expect(mockHydrateWhatsAppSession).toHaveBeenCalled();
    }
  });
});
