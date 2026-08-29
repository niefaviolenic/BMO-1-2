// @ts-nocheck
/* eslint-disable import/no-unresolved */
import Module from 'module';
import React from 'react';
import type * as ReactType from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactType>('react');
  return {
    ...actual,
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
  };
});

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
const originalRequire = moduleProto.require;
moduleProto.require = function (this: unknown, id: string): unknown {
  if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg') || id.includes('@/assets'))) {
    return 'mocked-asset';
  }
  return originalRequire.call(this, id);
};
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));


type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  [key: string]: unknown;
};

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
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    cardBackground: '#FFFFFF',
    cardPressed: '#F0F0F0',
    border: '#E5E5EB',
    divider: '#EDF0F5',
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    icon: '#333333',
    accentDot: '#007AFF',
  }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('lucide-react-native', () => ({
  Palette: (props: MockComponentProps) => ({ type: 'Palette', props }),
  Sun: (props: MockComponentProps) => ({ type: 'Sun', props }),
}));

type MockTree = {
  props: {
    testID?: string;
    accessibilityLabel?: string;
    onPress?: () => void;
    children?: MockTree[];
  };
};

let SettingsThemeSection: typeof import('./settings-theme-section').SettingsThemeSection;

describe('SettingsThemeSection', () => {
  beforeAll(async () => {
    const mod = await import('./settings-theme-section');
    SettingsThemeSection = mod.SettingsThemeSection;
  });

  it('renders with default appearance and accent values', () => {
    const onAppearance = vi.fn();
    const onAccent = vi.fn();

    const rendered = SettingsThemeSection({
      appearanceValue: 'System',
      accentColorLabel: 'Default',
      onAppearancePress: onAppearance,
      onAccentColorPress: onAccent,
      testID: 'theme-section',
    }) as unknown as MockTree;

    expect(rendered.props.testID).toBe('theme-section');

    const children = Array.isArray(rendered.props.children)
      ? rendered.props.children
      : [];
    const card = children[1];
    const cardChildren = Array.isArray(card?.props?.children)
      ? card.props.children
      : [];
    const appearanceWrapper = cardChildren[0];
    const appearanceRowChildren = Array.isArray(appearanceWrapper?.props?.children)
      ? appearanceWrapper.props.children
      : [];
    const appearanceSelector = appearanceRowChildren[2];

    const accentWrapper = cardChildren[2];
    const accentRowChildren = Array.isArray(accentWrapper?.props?.children)
      ? accentWrapper.props.children
      : [];
    const accentSelector = accentRowChildren[2];

    expect(appearanceSelector?.props?.accessibilityLabel).toBe('Appearance, currently System');
    appearanceSelector?.props?.onPress?.();
    expect(onAppearance).toHaveBeenCalled();

    expect(accentSelector?.props?.accessibilityLabel).toBe('Accent color, currently Default');
    accentSelector?.props?.onPress?.();
    expect(onAccent).toHaveBeenCalled();
  });
});
