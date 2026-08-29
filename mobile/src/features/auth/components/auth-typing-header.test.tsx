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

import { Colors } from '@/constants/theme';
import { AuthTypingHeader } from './auth-typing-header';

let mockCurrentTheme = Colors.light;

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => mockCurrentTheme,
}));

vi.mock('react-native', () => {
  class MockAnimatedValue {
    _value: number;
    constructor(val: number) {
      this._value = val;
    }
    setValue = vi.fn();
  }

  return {
    Platform: {
      OS: 'ios',
      select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
    },
    Animated: {
      Value: MockAnimatedValue,
      spring: vi.fn(() => ({
        start: vi.fn((callback?: (result: { finished: boolean }) => void) => {
          callback?.({ finished: true });
        }),
      })),
      View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Text: (props: MockComponentProps) => ({ type: 'Text', props }),
    View: (props: MockComponentProps) => ({ type: 'View', props }),
  };
});

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({
    type: 'Image',
    props,
  }),
}));

describe('AuthTypingHeader', () => {
  beforeEach(() => {
    mockCurrentTheme = Colors.light;
  });

  it('renders dot with light theme textTitle color in light mode', () => {
    mockCurrentTheme = Colors.light;
    const rendered = AuthTypingHeader({}) as unknown as {
      props: {
        children: [
          { type: string; props: { testID: string; style: unknown[] } },
          {
            type: string;
            props: {
              testID: string;
              children: {
                props: {
                  tintColor: string;
                  accessibilityLabel: string;
                };
              };
            };
          },
        ];
      };
    };

    const dotImageProps = rendered.props.children[1].props.children.props;
    expect(dotImageProps.accessibilityLabel).toBe('Typing indicator');
    expect(dotImageProps.tintColor).toBe(Colors.light.textTitle);
  });

  it('renders dot with dark theme textTitle color in dark mode', () => {
    mockCurrentTheme = Colors.dark;
    const rendered = AuthTypingHeader({}) as unknown as {
      props: {
        children: [
          { type: string; props: { testID: string; style: unknown[] } },
          {
            type: string;
            props: {
              testID: string;
              children: {
                props: {
                  tintColor: string;
                  accessibilityLabel: string;
                };
              };
            };
          },
        ];
      };
    };

    const dotImageProps = rendered.props.children[1].props.children.props;
    expect(dotImageProps.accessibilityLabel).toBe('Typing indicator');
    expect(dotImageProps.tintColor).toBe(Colors.dark.textTitle);
  });
});
