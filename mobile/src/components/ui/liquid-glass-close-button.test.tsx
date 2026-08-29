/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { Colors } from '@/constants/theme';
import { LiquidGlassCloseButton } from './liquid-glass-close-button';

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

vi.mock('./liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
  }),
}));

describe('LiquidGlassCloseButton', () => {
  beforeEach(() => {
    mockCurrentTheme = Colors.light;
  });

  it('uses light theme text color by default when in light mode', () => {
    mockCurrentTheme = Colors.light;
    const onPress = vi.fn();
    const rendered = LiquidGlassCloseButton({
      onPress,
      testID: 'close-btn',
    }) as unknown as {
      props: {
        children: {
          props: {
            children: string;
            style: Array<Record<string, unknown>>;
          };
        };
      };
    };

    expect(rendered.props.children.props.children).toBe('✕');
    expect(rendered.props.children.props.style).toEqual(
      expect.arrayContaining([{ color: Colors.light.text }])
    );
  });

  it('uses dark theme text color (#ffffff) by default when in dark mode', () => {
    mockCurrentTheme = Colors.dark;
    const onPress = vi.fn();
    const rendered = LiquidGlassCloseButton({
      onPress,
      testID: 'close-btn',
    }) as unknown as {
      props: {
        children: {
          props: {
            children: string;
            style: Array<Record<string, unknown>>;
          };
        };
      };
    };

    expect(rendered.props.children.props.children).toBe('✕');
    expect(rendered.props.children.props.style).toEqual(
      expect.arrayContaining([{ color: Colors.dark.text }])
    );
  });

  it('uses custom iconColor when explicitly provided', () => {
    mockCurrentTheme = Colors.dark;
    const onPress = vi.fn();
    const rendered = LiquidGlassCloseButton({
      onPress,
      iconColor: '#FF0000',
      testID: 'close-btn',
    }) as unknown as {
      props: {
        children: {
          props: {
            children: string;
            style: Array<Record<string, unknown>>;
          };
        };
      };
    };

    expect(rendered.props.children.props.style).toEqual(
      expect.arrayContaining([{ color: '#FF0000' }])
    );
  });
});
