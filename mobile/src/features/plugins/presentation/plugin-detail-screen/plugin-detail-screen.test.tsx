/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import Module from 'module';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type NodeModuleWithRequire = {
  require: (this: unknown, ...args: unknown[]) => unknown;
};

const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
const originalRequire = moduleProto.require;
moduleProto.require = function (this: unknown, ...args: unknown[]): unknown {
  const id = args[0];
  if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg') || id.includes('@/assets'))) {
    return 'mocked-asset';
  }
  return originalRequire.apply(this, args);
};

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};
vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  const mockUseRef = vi.fn((initial?: unknown) => ({ current: initial }));
  const mockUseCallback = vi.fn((fn: (...args: unknown[]) => unknown) => fn);
  const mockUseMemo = vi.fn((factory: () => unknown) => factory());
  const mockUseState = vi.fn((initial: unknown) => [
    typeof initial === 'function' ? (initial as () => unknown)() : initial,
    vi.fn(),
  ]);
  const mockUseEffect = vi.fn((effect: () => void | (() => void)) => {
    effect();
  });
  return {
    ...actual,
    default: {
      ...actual,
      useRef: mockUseRef,
      useCallback: mockUseCallback,
      useMemo: mockUseMemo,
      useState: mockUseState,
      useEffect: mockUseEffect,
    },
    useRef: mockUseRef,
    useCallback: mockUseCallback,
    useMemo: mockUseMemo,
    useState: mockUseState,
    useEffect: mockUseEffect,
  };
});

let mockParams: Record<string, unknown> = {};
const mockRouterBack = vi.fn();
const mockRouterReplace = vi.fn();
let mockCanGoBackValue = true;
let mockIsPluginInstalledValue = false;

vi.mock('lucide-react-native', () => ({
  Settings: (props: MockComponentProps) => ({ type: 'Settings', props }),
  Share2: (props: MockComponentProps) => ({ type: 'Share2', props }),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    replace: mockRouterReplace,
    push: vi.fn(),
    canGoBack: () => mockCanGoBackValue,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => callback(),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#000000',
    surface: '#111111',
    border: '#222222',
    text: '#FFFFFF',
    textSecondary: '#888888',
    textTitle: '#FFFFFF',
    icon: '#FFFFFF',
    primary: '#007AFF',
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('react-native', () => {
  class MockAnimatedValue {
    setValue = vi.fn();
    interpolate = vi.fn(() => 0);
    constructor(public val: number) {}
  }
  return {
    Platform: {
      OS: 'android',
      select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
    },
    View: (props: MockComponentProps) => ({ type: 'View', props }),
    Text: (props: MockComponentProps) => ({ type: 'Text', props }),
    ScrollView: (props: MockComponentProps) => ({ type: 'ScrollView', props }),
    Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    Alert: {
      alert: vi.fn(),
    },
    Share: {
      share: vi.fn().mockResolvedValue({ action: 'sharedAction' }),
    },
    Animated: {
      Value: MockAnimatedValue,
      timing: vi.fn(() => ({
        start: (cb?: () => void) => cb?.(),
      })),
      View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
    },
    Easing: {
      out: vi.fn((x) => x),
      in: vi.fn((x) => x),
      inOut: vi.fn((x) => x),
      ease: vi.fn(),
      cubic: vi.fn(),
    },
    BackHandler: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
  };
});

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: (props: MockComponentProps) => ({ type: 'LiquidGlassBackButton', props }),
}));

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({ type: 'LiquidGlassIconButton', props }),
}));

vi.mock('@/features/plugins/components', () => ({
  PluginAppSection: (props: MockComponentProps) => ({ type: 'PluginAppSection', props }),
  PluginBrandLogo: (props: MockComponentProps) => ({ type: 'PluginBrandLogo', props }),
  PluginConnectSheet: (props: MockComponentProps) => ({ type: 'PluginConnectSheet', props }),
  PluginDetailHero: (props: MockComponentProps) => ({ type: 'PluginDetailHero', props }),
  PluginInfoSection: (props: MockComponentProps) => ({ type: 'PluginInfoSection', props }),
  PluginLegalDisclaimer: (props: MockComponentProps) => ({ type: 'PluginLegalDisclaimer', props }),
  PluginPreviewCardsRow: (props: MockComponentProps) => ({ type: 'PluginPreviewCardsRow', props }),
  PluginSettingsSheet: (props: MockComponentProps) => ({ type: 'PluginSettingsSheet', props }),
  PluginSkillsSection: (props: MockComponentProps) => ({ type: 'PluginSkillsSection', props }),
  PluginUninstallModal: (props: MockComponentProps) => ({ type: 'PluginUninstallModal', props }),
}));

vi.mock('@/features/plugins/data/begin-spotify-oauth', () => ({
  beginSpotifyOAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/features/plugins/data/use-installed-plugins', () => ({
  useIsPluginInstalled: () => mockIsPluginInstalledValue,
  isPluginInstalled: () => mockIsPluginInstalledValue,
  installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
}));

vi.mock('@/features/plugins/data/plugin-catalog-store', () => ({
  refreshPluginCatalog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/plugins/data/spotify-session-store', () => ({
  hydrateSpotifySession: vi.fn().mockResolvedValue(undefined),
  startSpotifyPlaybackPolling: vi.fn(),
  stopSpotifyPlaybackPolling: vi.fn(),
  disconnectSpotifyIntegration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/plugins/data/use-whatsapp-session', () => ({
  useWhatsAppSession: () => ({
    connection: null,
    rules: [],
    conversations: [],
  }),
}));

vi.mock('@/features/plugins/data/whatsapp-session-store', () => ({
  disconnectWhatsAppIntegration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/plugins/presentation/notification-settings/connected-plugin-notification-settings-sheet', () => ({
  ConnectedPluginNotificationSettingsSheet: (props: MockComponentProps) => ({
    type: 'ConnectedPluginNotificationSettingsSheet',
    props,
  }),
}));

vi.mock('@/features/plugins/presentation/spotify-player', () => ({
  SpotifyPlayerPanel: (props: MockComponentProps) => ({ type: 'SpotifyPlayerPanel', props }),
}));

vi.mock('@/features/plugins/presentation/whatsapp-panel', () => ({
  WhatsAppNotificationPanel: (props: MockComponentProps) => ({ type: 'WhatsAppNotificationPanel', props }),
}));
import { Alert, Share } from 'react-native';
import { PluginDetailScreen } from './plugin-detail-screen';

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

describe('PluginDetailScreen', () => {
  beforeEach(() => {
    mockParams = {};
    mockRouterBack.mockClear();
    mockRouterReplace.mockClear();
    mockCanGoBackValue = true;
    mockIsPluginInstalledValue = false;
  });

  it('renders Spotify title and config when pluginId="spotify" is provided in params', () => {
    mockParams = { pluginId: 'spotify' };
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;
    expect(tree).toBeDefined();

    const backButton = findComponentByTestId(tree, 'test-screen-back-btn');
    expect(backButton).toBeDefined();

    // Call back when canGoBack is true
    backButton.props.onPress();
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to fallback route when router.canGoBack() is false', () => {
    mockParams = { id: 'spotify' };
    mockCanGoBackValue = false;
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;

    const backButton = findComponentByTestId(tree, 'test-screen-back-btn');
    expect(backButton).toBeDefined();

    backButton.props.onPress();
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(main)/plugins');
  });

  it('defaults to WhatsApp when no params are provided', () => {
    mockParams = {};
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;
    expect(tree).toBeDefined();
  });
  it('triggers Share.share with myjoy.binerlabs.com link when share button is pressed', async () => {
    mockParams = { id: 'spotify', title: 'Spotify' };
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;
    const shareButton = findComponentByTestId(tree, 'test-screen-share-btn');
    expect(shareButton).toBeDefined();

    await shareButton.props.onPress();
    expect(Share.share).toHaveBeenCalledWith({
      title: 'Spotify Plugin | Joy',
      message: 'Check out Spotify plugin on Joy: https://myjoy.binerlabs.com/plugins/spotify?open_in_app=true',
      url: 'https://myjoy.binerlabs.com/plugins/spotify?open_in_app=true',
    });
  });

  it('shows an alert when Share.share encounters an error', async () => {
    (Share.share as any).mockRejectedValueOnce(new Error('Share error'));
    mockParams = { id: 'whatsapp', title: 'WhatsApp' };
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;
    const shareButton = findComponentByTestId(tree, 'test-screen-share-btn');
    expect(shareButton).toBeDefined();

    await shareButton.props.onPress();
    expect(Alert.alert).toHaveBeenCalledWith('Unable to share', 'Please try again later.');
  });

  it('renders preview cards and hero when WhatsApp is not installed', () => {
    mockParams = { id: 'whatsapp', title: 'WhatsApp' };
    mockIsPluginInstalledValue = false;
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;

    const hero = findComponentByTestId(tree, 'test-screen-hero');
    expect(hero).toBeDefined();
    const previewCards = findComponentByTestId(tree, 'test-screen-preview-cards');
    expect(previewCards).toBeDefined();
    const floatingCta = findComponentByTestId(tree, 'test-screen-floating-cta');
    expect(floatingCta).toBeDefined();
    const waPanel = findComponentByTestId(tree, 'test-screen-whatsapp-panel');
    expect(waPanel).toBeNull();
  });

  it('renders WhatsAppNotificationPanel, hero, and floating CTA when WhatsApp is installed', () => {
    mockParams = { id: 'whatsapp', title: 'WhatsApp' };
    mockIsPluginInstalledValue = true;
    const tree = PluginDetailScreen({ testID: 'test-screen' }) as any;

    const waPanel = findComponentByTestId(tree, 'test-screen-whatsapp-panel');
    expect(waPanel).toBeDefined();
    const hero = findComponentByTestId(tree, 'test-screen-hero');
    expect(hero).toBeDefined();
    const floatingCta = findComponentByTestId(tree, 'test-screen-floating-cta');
    expect(floatingCta).toBeDefined();
  });
});
