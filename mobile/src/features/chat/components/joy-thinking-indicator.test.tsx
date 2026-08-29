/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

import { ChatTokens } from '@/constants/theme';
import { JoyThinkingIndicator } from './joy-thinking-indicator';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
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
    useMemo: vi.fn((fn: () => unknown) => fn()),
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
  };
});

vi.mock('react-native', () => {
  class MockAnimatedValue {
    _value: number;
    constructor(val: number) {
      this._value = val;
    }
    setValue = vi.fn();
    interpolate = vi.fn(() => 1);
  }

  return {
    Platform: {
      OS: 'ios',
      select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
    },
    AccessibilityInfo: {
      isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Animated: {
      Value: MockAnimatedValue,
      timing: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
      })),
      sequence: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
      })),
      loop: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
      })),
      View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
      Text: (props: MockComponentProps) => ({ type: 'Animated.Text', props }),
    },
    Easing: {
      out: vi.fn(),
      in: vi.fn(),
      inOut: vi.fn(),
      quad: vi.fn(),
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Text: (props: MockComponentProps) => ({ type: 'Text', props }),
    View: (props: MockComponentProps) => ({ type: 'View', props }),
  };
});

describe('JoyThinkingIndicator', () => {
  it('renders initial stage label and accessibility properties', () => {
    const element = JoyThinkingIndicator({
      testID: 'thinking-test',
    });

    expect(element.props.testID).toBe('thinking-test');
    expect(element.props.accessibilityRole).toBe('progressbar');
    expect(element.props.accessibilityLiveRegion).toBe('polite');
    expect(element.props.accessibilityLabel).toBe(ChatTokens.thinking.stages[0]);

    const children = React.Children.toArray(element.props.children);
    expect(children).toHaveLength(2); // dots container + label
  });

  it('defines stages in ChatTokens.thinking with progressive steps', () => {
    expect(ChatTokens.thinking.stages.length).toBeGreaterThan(1);
    expect(ChatTokens.thinking.stages[0]).toBe('Joy is thinking…');
    expect(ChatTokens.thinking.stageInterval).toBe(2800);
    expect(ChatTokens.thinking.fadeDuration).toBe(220);
  });
});
