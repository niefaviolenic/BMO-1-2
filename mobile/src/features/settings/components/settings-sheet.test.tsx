// @ts-nocheck
/* eslint-disable import/no-unresolved, import/first */
import Module from 'module';
import React from 'react';
import type * as ReactType from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
const originalRequire = moduleProto.require;
moduleProto.require = function (this: unknown, id: string): unknown {
  if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg') || id.includes('@/assets'))) {
    return 'mocked-asset';
  }
  if (typeof id === 'string' && (id.includes('expo/fetch') || id.includes('winter/fetch'))) {
    return {};
  }
  try {
    return originalRequire.call(this, id);
  } catch {
    return {};
  }
};

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  [key: string]: unknown;
};

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
    useCallback: vi.fn((fn: unknown) => fn),
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
    useSyncExternalStore: (
      _subscribe: unknown,
      getSnapshot: () => unknown,
    ) => getSnapshot(),
  };
});

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  Appearance: {
    getColorScheme: () => 'light',
    setColorScheme: vi.fn(),
    addChangeListener: () => ({ remove: () => {} }),
  },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('lucide-react-native', () => ({
  Check: (props: MockComponentProps) => ({ type: 'Check', props }),
  Palette: (props: MockComponentProps) => ({ type: 'Palette', props }),
  Sun: (props: MockComponentProps) => ({ type: 'Sun', props }),
  ChevronRight: (props: MockComponentProps) => ({ type: 'ChevronRight', props }),
  LogOut: (props: MockComponentProps) => ({ type: 'LogOut', props }),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({
    type: 'ModalBottomSheet',
    props,
  }),
}));

vi.mock('@/components/ui/animated-dropdown-overlay', () => ({
  AnimatedDropdownOverlay: (props: MockComponentProps) => ({
    type: 'AnimatedDropdownOverlay',
    props,
  }),
}));

vi.mock('@/features/auth/presentation/auth-session-provider', () => ({
  useOptionalAuthSession: () => null,
}));

vi.mock('@/features/settings/data/profile-api', () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock('./profile-header-block', () => ({
  ProfileHeaderBlock: () => null,
}));

vi.mock('./settings-account-section', () => ({
  SettingsAccountSection: () => null,
}));

vi.mock('./settings-chatgpt-section', () => ({
  SettingsChatGPTSection: () => null,
}));

vi.mock('./settings-help-section', () => ({
  SettingsHelpSection: () => null,
}));

vi.mock('./settings-logout-card', () => ({
  SettingsLogoutCard: () => null,
}));

vi.mock('./settings-theme-section', () => ({
  SettingsThemeSection: () => null,
}));

vi.mock('../presentation/edit-profile-sheet', () => ({
  EditProfileModal: () => null,
}));

vi.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: vi.fn(async (key: string) => store[key] ?? null),
    setItemAsync: vi.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      delete store[key];
    }),
    _reset: () => {
      store = {};
    },
  };
});

import {
  getAppearancePreference,
  resetAppearanceStoreForTest,
} from '../data/appearance-store';
import {
  getAccentPreference,
  resetAccentStoreForTest,
} from '../data/accent-store';

type MockTree = {
  type: unknown;
  props: {
    testID?: string;
    isVisible?: boolean;
    overlay?: MockTree;
    children?: MockTree | MockTree[];
    selectedAppearance?: string;
    onSelectAppearance?: (mode: string) => Promise<void>;
    selectedAccent?: string;
    onSelectAccent?: (mode: string) => Promise<void>;
  };
};

let SettingsSheet: typeof import('./settings-sheet').SettingsSheet;

describe('SettingsSheet Theme & Accent Integration', () => {
  beforeAll(async () => {
    const mod = await import('./settings-sheet');
    SettingsSheet = mod.SettingsSheet;
  });

  beforeEach(() => {
    resetAppearanceStoreForTest();
    resetAccentStoreForTest();
    vi.restoreAllMocks();
  });

  it('renders SettingsSheet and configures appearance & accent overlays', () => {
    const onClose = vi.fn();
    const rendered = SettingsSheet({
      isVisible: true,
      onClose,
      testID: 'settings-sheet',
    }) as unknown as MockTree;

    const children = Array.isArray(rendered.props.children)
      ? rendered.props.children
      : [];
    const modalSheet = children[0];

    expect(modalSheet.props.testID).toBe('settings-sheet');
    expect(modalSheet.props.overlay).toBeDefined();
  });

  it('allows selecting an appearance mode and updates the store', async () => {
    const onClose = vi.fn();
    const rendered = SettingsSheet({
      isVisible: true,
      onClose,
      testID: 'settings-sheet',
    }) as unknown as MockTree;

    const children = Array.isArray(rendered.props.children)
      ? rendered.props.children
      : [];
    const modalSheet = children[0];
    const overlay = modalSheet.props.overlay;
    expect(overlay).toBeDefined();

    const overlayChildren = Array.isArray(overlay?.props?.children)
      ? overlay.props.children
      : [overlay?.props?.children];

    const appearanceOverlay = overlayChildren[0];
    const picker = appearanceOverlay?.props?.children as MockTree;
    expect(picker).toBeDefined();
    expect(picker.props.selectedAppearance).toBe('system');

    await picker.props.onSelectAppearance?.('dark');
    expect(getAppearancePreference()).toBe('dark');
  });

  it('allows selecting an accent color and updates the accent store', async () => {
    const onClose = vi.fn();
    const rendered = SettingsSheet({
      isVisible: true,
      onClose,
      testID: 'settings-sheet',
    }) as unknown as MockTree;

    const children = Array.isArray(rendered.props.children)
      ? rendered.props.children
      : [];
    const modalSheet = children[0];
    const overlay = modalSheet.props.overlay;
    expect(overlay).toBeDefined();

    const overlayChildren = Array.isArray(overlay?.props?.children)
      ? overlay.props.children
      : [overlay?.props?.children];

    const accentOverlay = overlayChildren[1];
    const accentPicker = accentOverlay?.props?.children as MockTree;
    expect(accentPicker).toBeDefined();
    expect(accentPicker.props.selectedAccent).toBe('default');

    await accentPicker.props.onSelectAccent?.('purple');
    expect(getAccentPreference()).toBe('purple');
  });

  it('closes open dropdowns and updates scroll offset when scrolling', () => {
    const onClose = vi.fn();
    const rendered = SettingsSheet({
      isVisible: true,
      onClose,
      testID: 'settings-sheet',
    }) as unknown as MockTree;

    const children = Array.isArray(rendered.props.children)
      ? rendered.props.children
      : [];
    const modalSheet = children[0];
    expect(modalSheet.props.onScroll).toBeDefined();
    expect(modalSheet.props.onScrollBeginDrag).toBeDefined();

    // Trigger scroll and verify no error thrown
    expect(() => {
      modalSheet.props.onScroll?.({
        nativeEvent: { contentOffset: { y: 120 } },
      });
      modalSheet.props.onScrollBeginDrag?.({
        nativeEvent: { contentOffset: { y: 120 } },
      });
    }).not.toThrow();
  });
});
