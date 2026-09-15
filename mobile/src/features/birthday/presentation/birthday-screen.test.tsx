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
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    text: '#0D0D0D',
    textTitle: '#0F1729',
    textSecondary: '#60646C',
    textMuted: '#808794',
    icon: '#0F1729',
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
    Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      absoluteFillObject: {},
    },
    useWindowDimensions: vi.fn(() => ({ width: 390, height: 844 })),
    Animated: {
      Value: MockAnimatedValue,
      spring: vi.fn(() => ({ start: vi.fn() })),
      timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      sequence: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      parallel: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      loop: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      delay: vi.fn(() => ({})),
      View: (props: unknown) => ({ type: 'Animated.View', props }),
    },
    Easing: { bezier: vi.fn() },
    ScrollView: (props: unknown) => ({ type: 'ScrollView', props }),
    Pressable: (props: unknown) => ({ type: 'Pressable', props }),
    Text: (props: unknown) => ({ type: 'Text', props }),
    View: (props: unknown) => ({ type: 'View', props }),
  };
});

vi.mock('expo-status-bar', () => ({
  StatusBar: (props: unknown) => ({ type: 'StatusBar', props }),
}));

vi.mock('expo-image', () => ({
  Image: (props: unknown) => ({ type: 'Image', props }),
}));

import { BirthdayScreen } from './birthday-screen';

describe('BirthdayScreen', () => {
  it('renders correctly with content and continue button', () => {
    const handleContinue = vi.fn();
    const element = BirthdayScreen({ onContinue: handleContinue, testID: 'test-birthday' });

    expect(element.props.testID).toBe('test-birthday');
    expect(element.props.children).toBeDefined();
  });
});
