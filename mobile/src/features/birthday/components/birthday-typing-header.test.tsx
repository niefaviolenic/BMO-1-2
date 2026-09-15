import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react');
  return {
    ...actual,
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
    useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
  };
});

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    textTitle: '#0F1729',
  }),
}));

vi.mock('react-native', () => {
  class MockAnimatedValue {
    _value: number;
    constructor(val: number) {
      this._value = val;
    }
    setValue = vi.fn();
    interpolate = vi.fn(() => 0);
  }

  return {
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Animated: {
      Value: MockAnimatedValue,
      spring: vi.fn(() => ({ start: vi.fn() })),
      timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      sequence: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      loop: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      multiply: vi.fn(() => ({})),
      View: (props: unknown) => ({ type: 'Animated.View', props }),
    },
    Easing: {
      inOut: vi.fn(),
      ease: {},
    },
    Text: (props: unknown) => ({ type: 'Text', props }),
    View: (props: unknown) => ({ type: 'View', props }),
  };
});

vi.mock('expo-image', () => ({
  Image: (props: unknown) => ({ type: 'Image', props }),
}));

import { BirthdayTypingHeader } from './birthday-typing-header';

describe('BirthdayTypingHeader', () => {
  it('renders correctly with text and animated dot container', () => {
    const element = BirthdayTypingHeader({ testID: 'test-typing-header' });
    expect(element.props.testID).toBe('test-typing-header');
    expect(element.props.children).toBeDefined();
  });
});
