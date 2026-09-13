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
let mockRobotConnection = {
  status: 'disconnected',
  device: null as unknown,
  isHydrating: false,
  isPairing: false,
  isUnpairing: false,
  error: null as string | null,
};

let mockWhatsAppSession = {
  connection: null as { status: string } | null,
  pairing: null as { code: string | null; expiresAt: string | null; status?: string } | null,
  qr: null as { qr: string | null; expiresAt: string | null } | null,
  rules: [],
  conversations: [],
  isConnecting: false,
  isLoadingRules: false,
  error: null,
};

const mockStartWhatsAppConnect = vi.fn().mockResolvedValue({
  connection: { status: 'DISCONNECTED' },
  pairing: { code: '8K2P9XLM', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'PENDING' },
});
const mockStopWhatsAppConnectPolling = vi.fn();
const mockHydrateWhatsAppSession = vi.fn().mockResolvedValue(undefined);
const mockGetWhatsAppSessionState = vi.fn(() => mockWhatsAppSession);
const mockSetStringAsync = vi.fn().mockResolvedValue(true);

let mockStateMap: Record<string, unknown> = {};
let mockSetStateMap: Record<string, (val: unknown) => void> = {};

vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    useRef: vi.fn((initial?: unknown) => ({ current: initial })),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useMemo: vi.fn((factory: () => unknown) => factory()),
    useState: vi.fn((initial: unknown) => {
      const key = typeof initial === 'string' ? `str_${initial}` : typeof initial;
      if (!(key in mockStateMap)) {
        mockStateMap[key] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const setter = vi.fn((val: unknown) => {
        mockStateMap[key] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(mockStateMap[key]) : val;
      });
      mockSetStateMap[key] = setter;
      return [mockStateMap[key], setter];
    }),
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
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  ScrollView: (props: MockComponentProps) => ({ type: 'ScrollView', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  Platform: {
    OS: 'ios',
    select: vi.fn((obj: Record<string, unknown>) => obj.ios ?? obj.default),
  },
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: (text: string) => mockSetStringAsync(text),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));
vi.mock('react-native-qrcode-svg', () => ({
  default: (props: MockComponentProps) => ({ type: 'QRCode', props }),
}));


vi.mock('lucide-react-native', () => ({
  Check: (props: MockComponentProps) => ({ type: 'Check', props }),
  Copy: (props: MockComponentProps) => ({ type: 'Copy', props }),
  RefreshCw: (props: MockComponentProps) => ({ type: 'RefreshCw', props }),
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

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#E0E0E0',
    cardBackground: '#F9F9F9',
    buttonPrimaryBackground: '#000000',
    buttonPrimaryText: '#FFFFFF',
  }),
}));

vi.mock('@/constants/theme', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
  };
});

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
  toWhatsAppE164: (phone: string) => {
    const digits = phone.replace(/\D/gu, '');
    if (digits.startsWith('62')) return `+${digits}`;
    if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
    return `+62${digits}`;
  },
  formatWhatsAppDisplayNumber: (phone?: string) => phone ?? '',
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
  startWhatsAppConnect: (phone?: string, opts?: unknown) => mockStartWhatsAppConnect(phone, opts),
  stopWhatsAppConnectPolling: () => mockStopWhatsAppConnectPolling(),
  hydrateWhatsAppSession: () => mockHydrateWhatsAppSession(),
  getWhatsAppSessionState: () => mockGetWhatsAppSessionState(),
}));

vi.mock('@/hooks/use-step-slide-transition', () => ({
  useStepSlideTransition: ({ currentStep }: { currentStep: string }) => ({
    activeStep: currentStep,
    contentTranslateX: 0,
  }),
}));

vi.mock('@/features/plugins/presentation/whatsapp-pairing/components', () => ({
  ActiveJoyCapabilitiesCard: (props: MockComponentProps) => ({ type: 'ActiveJoyCapabilitiesCard', props }),
  PairingCodeDisplayBox: (props: MockComponentProps) => ({ type: 'PairingCodeDisplayBox', props }),
  PairingCodeHero: (props: MockComponentProps) => ({ type: 'PairingCodeHero', props }),
  PairingInstructionsCard: (props: MockComponentProps) => ({ type: 'PairingInstructionsCard', props }),
  PairingPhoneHero: (props: MockComponentProps) => ({ type: 'PairingPhoneHero', props }),
  PairingSuccessHero: (props: MockComponentProps) => ({ type: 'PairingSuccessHero', props }),
  PhoneNumberInputCard: (props: MockComponentProps) => ({ type: 'PhoneNumberInputCard', props }),
  QRPairingHero: (props: MockComponentProps) => ({ type: 'QRPairingHero', props }),
  QRCodeDisplayBox: (props: MockComponentProps) => QRCodeDisplayBox(props as unknown as Parameters<typeof QRCodeDisplayBox>[0]),
}));

type ElementNode = {
  props?: {
    testID?: string;
    children?: ElementNode | ElementNode[];
    [key: string]: unknown;
  };
};

function findComponentByTestId(node: unknown, testID: string): ElementNode | null {
  if (!node || typeof node !== 'object') return null;
  const element = node as ElementNode;
  if (element.props?.testID === testID) return element;
  const children = React.Children.toArray(element.props?.children as React.ReactNode);
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
});

describe('WhatsAppConnectScreen Component (8-Digit Pairing Code Flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStateMap = {};
    mockSetStateMap = {};
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
      qr: null,
      rules: [],
      conversations: [],
      isConnecting: false,
      isLoadingRules: false,
      error: null,
    };
  });

  it('renders phone input step initially with PairingPhoneHero, PhoneNumberInputCard, and disabled CTA', () => {
    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    expect(element.props.testID).toBe('whatsapp-connect');

    const phoneHero = findComponentByTestId(element, 'whatsapp-connect-phone-hero');
    expect(phoneHero).toBeDefined();

    const phoneInput = findComponentByTestId(element, 'whatsapp-connect-phone-input');
    expect(phoneInput).toBeDefined();
    expect(phoneInput.props.countryCode).toBe('+62');

    const instructions = findComponentByTestId(element, 'whatsapp-connect-phone-instructions');
    expect(instructions).toBeDefined();
    expect(instructions.props.steps).toHaveLength(3);

    const getCodeButton = findComponentByTestId(element, 'whatsapp-connect-get-code-cta-button');
    expect(getCodeButton).toBeDefined();
    expect(getCodeButton.props.disabled).toBe(true);
  });

  it('subscribes to AppState changes and refreshes session on active', () => {
    WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    expect(mockAppStateChangeCallback).toBeDefined();

    if (mockAppStateChangeCallback) {
      mockAppStateChangeCallback('active');
      expect(mockHydrateWhatsAppSession).toHaveBeenCalled();
    }
  });

  it('renders success hero and capabilities card when status is CONNECTED', () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      connection: { status: 'CONNECTED' },
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });

    const successHero = findComponentByTestId(element, 'whatsapp-connect-success-hero');
    expect(successHero).toBeDefined();

    const capabilities = findComponentByTestId(element, 'whatsapp-connect-capabilities');
    expect(capabilities).toBeDefined();

    const doneButton = findComponentByTestId(element, 'whatsapp-connect-done-cta-button');
    expect(doneButton).toBeDefined();
  });

  it('calls startWhatsAppConnect when Get Pairing Code button is pressed', async () => {
    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    const phoneInput = findComponentByTestId(element, 'whatsapp-connect-phone-input');
    phoneInput.props.onChangePhoneNumber('081234567890');

    const updatedElement = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    const getCodeButton = findComponentByTestId(updatedElement, 'whatsapp-connect-get-code-cta-button');
    expect(getCodeButton.props.disabled).toBe(false);

    await getCodeButton.props.onPress();
    expect(mockStartWhatsAppConnect).toHaveBeenCalledWith('+6281234567890', { forceReset: true });
  });

  it('renders pairing code step when pairing code is present in session', () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      pairing: {
        code: '8K2P9XLM',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        status: 'PENDING',
      },
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    const codeHero = findComponentByTestId(element, 'whatsapp-connect-code-hero');
    expect(codeHero).toBeDefined();

    const codeBox = findComponentByTestId(element, 'whatsapp-connect-code-box');
    expect(codeBox).toBeDefined();
    expect(codeBox.props.code).toBe('8K2P9XLM');

    const copyButton = findComponentByTestId(element, 'whatsapp-connect-copy-code-cta-button');
    expect(copyButton).toBeDefined();

    const changePhoneButton = findComponentByTestId(element, 'whatsapp-connect-change-phone-cta-button');
    expect(changePhoneButton).toBeDefined();
  });

  it('copies pairing code to clipboard when copy button is pressed', async () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      pairing: {
        code: '8K2P9XLM',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        status: 'PENDING',
      },
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    const copyButton = findComponentByTestId(element, 'whatsapp-connect-copy-code-cta-button');
    await copyButton.props.onPress();

    expect(mockSetStringAsync).toHaveBeenCalledWith('8K2P9XLM');
  });

  it('renders Request New Code button when code is expired', () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      pairing: {
        code: '8K2P9XLM',
        expiresAt: new Date(Date.now() - 5000).toISOString(),
        status: 'PENDING',
      },
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    const reloadButton = findComponentByTestId(element, 'whatsapp-connect-reload-code-cta-button');
    expect(reloadButton).toBeDefined();
    expect(reloadButton.props.accessibilityLabel).toBe('Request New Code');
  });

  it('stops polling and returns to phone step when Change Phone Number is pressed', () => {
    mockWhatsAppSession = {
      ...mockWhatsAppSession,
      pairing: {
        code: '8K2P9XLM',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        status: 'PENDING',
      },
    };

    const element = WhatsAppConnectScreen({ testID: 'whatsapp-connect' });
    const changePhoneButton = findComponentByTestId(element, 'whatsapp-connect-change-phone-cta-button');
    changePhoneButton.props.onPress();

    expect(mockStopWhatsAppConnectPolling).toHaveBeenCalled();
  });
});
