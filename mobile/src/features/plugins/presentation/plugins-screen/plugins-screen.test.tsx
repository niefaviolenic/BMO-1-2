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

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  const mockUseRef = vi.fn((initial) => ({ current: initial }));
  const mockUseCallback = vi.fn((fn) => fn);
  const mockUseMemo = vi.fn((factory) => factory());
  const mockUseState = vi.fn((initial) => [
    typeof initial === 'function' ? initial() : initial,
    vi.fn(),
  ]);
  const mockUseEffect = vi.fn((effect) => {
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

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useFocusEffect: (cb: () => void) => cb(),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#FFFFFF',
    icon: '#FFFFFF',
    textMuted: '#888888',
    textSecondary: '#AAAAAA',
    accent: '#3B82F6',
  }),
}));

vi.mock('react-native', () => {
  class MockAnimatedValue {
    setValue = vi.fn();
    interpolate = vi.fn(() => 0);
    constructor(val) {
      this._val = val;
    }
  }
  return {
    Platform: {
      OS: 'android',
      select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    useWindowDimensions: () => ({ width: 375, height: 812 }),
    ScrollView: (props: MockComponentProps) => ({ type: 'ScrollView', props }),
    Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
    Text: (props: MockComponentProps) => ({ type: 'Text', props }),
    View: (props: MockComponentProps) => ({ type: 'View', props }),
    Modal: (props: MockComponentProps) => ({ type: 'Modal', props }),
    ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
    Alert: { alert: vi.fn() },
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

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
  }),
}));

vi.mock('@/components/ui/search-input', () => ({
  SearchInput: (props: MockComponentProps) => ({ type: 'SearchInput', props }),
}));

vi.mock('@/features/chat/presentation/sidebar-shell', () => ({
  useSidebarShell: () => ({
    open: vi.fn(),
    navigate: vi.fn(),
    registerActions: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('@/features/plugins/data/begin-spotify-oauth', () => ({
  beginSpotifyOAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/features/plugins/data/plugin-catalog-store', () => ({
  refreshPluginCatalog: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/plugins/components/plugin-item-row', () => ({
  PluginItemRow: (props: MockComponentProps) => ({ type: 'PluginItemRow', props }),
}));
vi.mock('@/features/plugins/data/whatsapp-session-store', () => ({
  disconnectWhatsAppIntegration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/plugins/data/spotify-session-store', () => ({
  disconnectSpotifyIntegration: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/plugins/components/installed-plugins-row', () => ({
  InstalledPluginsRow: (props: MockComponentProps) => ({ type: 'InstalledPluginsRow', props }),
}));

vi.mock('@/features/plugins/components/plugin-brand-logo', () => ({
  PluginBrandLogo: (props: MockComponentProps) => ({ type: 'PluginBrandLogo', props }),
}));

vi.mock('@/features/plugins/components/plugin-uninstall-modal', () => ({
  PluginUninstallModal: (props: MockComponentProps) => ({ type: 'PluginUninstallModal', props }),
}));

vi.mock('@/features/plugins/components/plugin-connect-sheet', () => ({
  PluginConnectSheet: (props: MockComponentProps) => ({ type: 'PluginConnectSheet', props }),
}));

let mockInstalledPlugins: Array<{ id: string; name: string }> = [];

vi.mock('@/features/plugins/data/use-installed-plugins', () => ({
  useInstalledPlugins: () => mockInstalledPlugins,
  isPluginInstalled: (id: string) => mockInstalledPlugins.some((p) => p.id === id),
  installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
}));

import { PluginsScreen } from './plugins-screen';

function findElementByTestID(tree: unknown, testID: string): any {
  if (!tree || typeof tree !== 'object') {
    return null;
  }
  const node = tree as { props?: { testID?: string; children?: unknown } };
  if (node.props?.testID === testID) {
    return node;
  }
  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElementByTestID(child, testID);
      if (match) {
        return match;
      }
    }
  } else if (children) {
    return findElementByTestID(children, testID);
  }
  return null;
}

describe('PluginsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstalledPlugins = [];
  });

  it('renders add action on uninstalled plugins and does not show installed section when empty', () => {
    mockInstalledPlugins = [];
    const tree = PluginsScreen({});

    const installedSection = findElementByTestID(tree, 'plugins-screen-installed-section');
    expect(installedSection).toBeNull();

    const whatsappItem = findElementByTestID(tree, 'plugins-screen-item-whatsapp');
    expect(whatsappItem).toBeTruthy();
    expect(whatsappItem.props.actionType).toBe('add');
  });

  it('renders trash action on whatsapp when installed and shows installed section', () => {
    mockInstalledPlugins = [{ id: 'whatsapp', name: 'WhatsApp' }];
    const tree = PluginsScreen({});

    const installedSection = findElementByTestID(tree, 'plugins-screen-installed-section');
    expect(installedSection).toBeTruthy();

    const whatsappItem = findElementByTestID(tree, 'plugins-screen-item-whatsapp');
    expect(whatsappItem).toBeTruthy();
    expect(whatsappItem.props.actionType).toBe('trash');
  });
});
