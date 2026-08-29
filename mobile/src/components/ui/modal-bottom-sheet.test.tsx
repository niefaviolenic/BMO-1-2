// @ts-nocheck
/* eslint-disable import/no-unresolved */
import React from 'react';
import type * as ReactType from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { ModalBottomSheet } from './modal-bottom-sheet';

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
    useMemo: vi.fn((factory: () => unknown) => factory()),
  };
});

type MockElement = {
  type?: unknown;
  props?: {
    children?: unknown;
    onScroll?: (event: unknown) => void;
    onScrollBeginDrag?: (event: unknown) => void;
    [key: string]: unknown;
  };
};

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    modalBackground: '#1E1E1E',
    border: '#333333',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

vi.mock('react-native', () => {
  class MockAnimatedValue {
    _value: number;
    setValue = vi.fn();
    interpolate = vi.fn().mockReturnValue(0);
    constructor(val: number) {
      this._value = val;
    }
  }

  const actualAnimated = {
    Value: MockAnimatedValue,
    timing: vi.fn().mockReturnValue({ start: (cb?: () => void) => cb?.() }),
    spring: vi.fn().mockReturnValue({ start: (cb?: () => void) => cb?.() }),
    parallel: vi.fn().mockReturnValue({ start: (cb?: (res: { finished: boolean }) => void) => cb?.({ finished: true }) }),
    View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
  };
  return {
    Platform: {
      OS: 'ios',
      select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
    },
    Animated: actualAnimated,
    BackHandler: {
      addEventListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    },
    Easing: {
      out: vi.fn().mockReturnValue((v: number) => v),
      in: vi.fn().mockReturnValue((v: number) => v),
      cubic: (v: number) => v,
    },
    Keyboard: {
      dismiss: vi.fn(),
    },
    Modal: (props: MockComponentProps) => ({ type: 'Modal', props }),
    Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Text: (props: MockComponentProps) => ({ type: 'Text', props }),
    View: (props: MockComponentProps) => ({ type: 'View', props }),
  };
});

vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (props: MockComponentProps) => ({ type: 'GestureHandlerRootView', props }),
  PanGestureHandler: (props: MockComponentProps) => ({ type: 'PanGestureHandler', props }),
  ScrollView: (props: MockComponentProps) => ({ type: 'GestureScrollView', props }),
  State: { ACTIVE: 4 },
}));

vi.mock('./liquid-glass-back-button', () => ({
  LiquidGlassBackButton: () => null,
}));

vi.mock('./liquid-glass-close-button', () => ({
  LiquidGlassCloseButton: () => null,
}));

describe('ModalBottomSheet Scroll Handling', () => {
  it('forwards onScroll and onScrollBeginDrag events to GestureScrollView', () => {
    const onScroll = vi.fn();
    const onScrollBeginDrag = vi.fn();
    const onClose = vi.fn();

    const element = ModalBottomSheet({
      isVisible: true,
      onClose,
      onScroll,
      onScrollBeginDrag,
      variant: 'overlay',
      children: <></>,
    });

    expect(element).toBeDefined();
    // Locate GestureScrollView inside the tree
    const findComponent = (node: unknown, targetType: unknown): MockElement | null => {
      if (!node || typeof node !== 'object') return null;
      const elementNode = node as MockElement;
      if (elementNode.type === targetType) return elementNode;
      if (elementNode.props?.children) {
        const children = Array.isArray(elementNode.props.children)
          ? elementNode.props.children
          : [elementNode.props.children];
        for (const child of children) {
          const found = findComponent(child, targetType);
          if (found) return found;
        }
      }
      return null;
    };

    const scrollView = findComponent(element, GestureScrollView);
    expect(scrollView).toBeDefined();
    expect(scrollView.props.onScrollBeginDrag).toBe(onScrollBeginDrag);

    // Trigger onScroll
    const fakeScrollEvent = {
      nativeEvent: {
        contentOffset: { y: 150 },
      },
    };
    scrollView.props.onScroll(fakeScrollEvent);
    expect(onScroll).toHaveBeenCalledWith(fakeScrollEvent);
  });
});
