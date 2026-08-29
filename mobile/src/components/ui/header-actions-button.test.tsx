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

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    default: actual,
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
    useMemo: vi.fn((fn: () => unknown) => fn()),
    useCallback: vi.fn((fn: unknown) => fn),
  };
});

import { Colors } from '@/constants/theme';
import { HeaderActionsButton } from './header-actions-button';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  style?: unknown;
  tintColor?: string;
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
    absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    flatten: (style: unknown) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
  },
  Animated: {
    Value: class {
      value: number;
      constructor(val: number) {
        this.value = val;
      }
    },
    timing: () => ({
      start: (cb?: () => void) => cb?.(),
    }),
    parallel: (animations: unknown[]) => ({
      start: (cb?: () => void) => cb?.(),
    }),
    View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
  },
  Easing: {
    out: () => () => {},
    cubic: () => {},
    quad: () => {},
    inOut: () => () => {},
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

describe('HeaderActionsButton', () => {
  beforeEach(() => {
    mockCurrentTheme = Colors.light;
  });

  it('renders correctly with light theme tokens', () => {
    mockCurrentTheme = Colors.light;
    const element = HeaderActionsButton({}) as unknown as {
      props: {
        children: [
          {
            props: {
              style: unknown[];
              children: [
                { props: { children: { props: { tintColor: string } } } },
                { props: { children: { props: { tintColor: string } } } }
              ];
            };
          },
          unknown
        ];
      };
    };

    const baseCapsule = element.props.children[0];
    const baseStyles = Object.assign({}, ...(baseCapsule.props.style as object[]));

    expect(baseStyles.backgroundColor).toBe(Colors.light.glassButtonBackground);
    expect(baseStyles.borderColor).toBe(Colors.light.glassButtonBorder);
    expect(baseStyles.borderWidth).toBe(1);

    const editIcon = baseCapsule.props.children[0].props.children;
    const moreIcon = baseCapsule.props.children[1].props.children;

    expect(editIcon.props.tintColor).toBe(Colors.light.icon);
    expect(moreIcon.props.tintColor).toBe(Colors.light.icon);
  });

  it('renders correctly with dark theme tokens (reverse colors)', () => {
    mockCurrentTheme = Colors.dark;
    const element = HeaderActionsButton({}) as unknown as {
      props: {
        children: [
          {
            props: {
              style: unknown[];
              children: [
                { props: { children: { props: { tintColor: string } } } },
                { props: { children: { props: { tintColor: string } } } }
              ];
            };
          },
          unknown
        ];
      };
    };

    const baseCapsule = element.props.children[0];
    const baseStyles = Object.assign({}, ...(baseCapsule.props.style as object[]));

    expect(baseStyles.backgroundColor).toBe(Colors.dark.glassButtonBackground);
    expect(baseStyles.backgroundColor).toBe('#22252C');
    expect(baseStyles.borderColor).toBe(Colors.dark.glassButtonBorder);
    expect(baseStyles.borderWidth).toBe(1);

    const editIcon = baseCapsule.props.children[0].props.children;
    const moreIcon = baseCapsule.props.children[1].props.children;

    expect(editIcon.props.tintColor).toBe(Colors.dark.icon);
    expect(editIcon.props.tintColor).toBe('#F8FAFC');
    expect(moreIcon.props.tintColor).toBe(Colors.dark.icon);
    expect(moreIcon.props.tintColor).toBe('#F8FAFC');
  });

  it('supports custom backgroundColor, borderColor, and iconColor overrides', () => {
    const element = HeaderActionsButton({
      backgroundColor: '#123456',
      borderColor: '#654321',
      iconColor: '#AABBCC',
    }) as unknown as {
      props: {
        children: [
          {
            props: {
              style: unknown[];
              children: [
                { props: { children: { props: { tintColor: string } } } },
                { props: { children: { props: { tintColor: string } } } }
              ];
            };
          },
          unknown
        ];
      };
    };

    const baseCapsule = element.props.children[0];
    const baseStyles = Object.assign({}, ...(baseCapsule.props.style as object[]));

    expect(baseStyles.backgroundColor).toBe('#123456');
    expect(baseStyles.borderColor).toBe('#654321');

    const editIcon = baseCapsule.props.children[0].props.children;
    expect(editIcon.props.tintColor).toBe('#AABBCC');
  });

  it('invokes callback when touched and released inside bounds', () => {
    const handleEdit = vi.fn();
    const handleMore = vi.fn();

    const element = HeaderActionsButton({
      onPressEdit: handleEdit,
      onPressMore: handleMore,
    }) as unknown as {
      props: {
        children: [
          unknown,
          {
            props: {
              children: [
                {
                  props: {
                    onResponderRelease: (e: { nativeEvent: { locationX: number; locationY: number } }) => void;
                  };
                },
                {
                  props: {
                    onResponderRelease: (e: { nativeEvent: { locationX: number; locationY: number } }) => void;
                  };
                }
              ];
            };
          }
        ];
      };
    };

    const overlayRow = element.props.children[1];
    const editTouch = overlayRow.props.children[0];
    const moreTouch = overlayRow.props.children[1];

    editTouch.props.onResponderRelease({ nativeEvent: { locationX: 20, locationY: 20 } });
    expect(handleEdit).toHaveBeenCalledTimes(1);

    moreTouch.props.onResponderRelease({ nativeEvent: { locationX: 20, locationY: 20 } });
    expect(handleMore).toHaveBeenCalledTimes(1);
  });
});
