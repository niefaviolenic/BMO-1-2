/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import Module from 'module';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import { Colors } from '@/constants/theme';
import { LiquidGlassBackButton } from './liquid-glass-back-button';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

let mockCurrentTheme = Colors.light;

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => mockCurrentTheme,
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({
    type: 'Image',
    props,
  }),
}));

vi.mock('./liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
  }),
}));

describe('LiquidGlassBackButton', () => {
  beforeEach(() => {
    mockCurrentTheme = Colors.light;
  });

  it('uses light theme icon color by default when in light mode', () => {
    mockCurrentTheme = Colors.light;
    const onPress = vi.fn();
    const rendered = LiquidGlassBackButton({
      onPress,
      testID: 'back-btn',
    }) as unknown as {
      props: {
        children: {
          props: {
            tintColor: string;
            accessibilityLabel: string;
          };
        };
      };
    };

    expect(rendered.props.children.props.accessibilityLabel).toBe('Back');
    expect(rendered.props.children.props.tintColor).toBe(Colors.light.icon);
  });

  it('uses dark theme icon color (#F8FAFC) by default when in dark mode', () => {
    mockCurrentTheme = Colors.dark;
    const onPress = vi.fn();
    const rendered = LiquidGlassBackButton({
      onPress,
      testID: 'back-btn',
    }) as unknown as {
      props: {
        children: {
          props: {
            tintColor: string;
            accessibilityLabel: string;
          };
        };
      };
    };

    expect(rendered.props.children.props.accessibilityLabel).toBe('Back');
    expect(rendered.props.children.props.tintColor).toBe(Colors.dark.icon);
  });

  it('uses custom iconColor when explicitly provided', () => {
    mockCurrentTheme = Colors.dark;
    const onPress = vi.fn();
    const rendered = LiquidGlassBackButton({
      onPress,
      iconColor: '#FF0000',
      testID: 'back-btn',
    }) as unknown as {
      props: {
        children: {
          props: {
            tintColor: string;
          };
        };
      };
    };

    expect(rendered.props.children.props.tintColor).toBe('#FF0000');
  });
});
