import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react');
  return {
    ...actual,
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

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
      absoluteFillObject: {},
    },
    useWindowDimensions: vi.fn(() => ({ width: 390, height: 844 })),
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
      parallel: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
      })),
      loop: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
      })),
      delay: vi.fn(() => ({})),
      View: (props: unknown) => ({ type: 'Animated.View', props }),
    },
    Easing: {
      bezier: vi.fn(),
    },
    View: (props: unknown) => ({ type: 'View', props }),
  };
});

import { ConfettiCannon } from './confetti-cannon';

describe('ConfettiCannon', () => {
  it('renders correctly with pointerEvents none', () => {
    const element = ConfettiCannon({ testID: 'test-confetti' });
    expect(element.props.testID).toBe('test-confetti');
    expect(element.props.pointerEvents).toBe('none');
    expect(element.props.children).toBeDefined();
    expect(Array.isArray(element.props.children)).toBe(true);
    expect(element.props.children.length).toBeGreaterThan(0);
  });
});
