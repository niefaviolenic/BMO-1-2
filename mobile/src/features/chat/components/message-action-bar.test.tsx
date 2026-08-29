/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

import { MessageActionBar } from './message-action-bar';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

vi.mock('react-native', () => ({
  ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
  Animated: {
    Value: vi.fn(() => ({})),
    timing: vi.fn(() => ({ start: vi.fn() })),
    View: (props: MockComponentProps) => ({ type: 'Animated.View', props }),
  },
  Easing: {
    out: vi.fn(),
    inOut: vi.fn(),
    quad: vi.fn(),
  },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('lucide-react-native', () => ({
  Copy: (props: MockComponentProps) => ({ type: 'Copy', props }),
  Volume2: (props: MockComponentProps) => ({ type: 'Volume2', props }),
  VolumeX: (props: MockComponentProps) => ({ type: 'VolumeX', props }),
  ThumbsDown: (props: MockComponentProps) => ({ type: 'ThumbsDown', props }),
  Share: (props: MockComponentProps) => ({ type: 'Share', props }),
}));

vi.mock('@/constants/theme', () => ({
  Colors: { light: {}, dark: {} },
  MessageActionBarTokens: {
    height: 26,
    itemSpacing: 16,
    iconSize: 18,
    iconColor: '#9CA3AF',
    activeColor: '#18181B',
    selectedColor: '#EF4444',
    strokeWidth: 1.75,
    paddingVertical: 2,
  },
}));

describe('MessageActionBar', () => {
  it('renders copy, speak, thumbs-down, and share buttons, without more options button', () => {
    const rendered = MessageActionBar({ testID: 'action-bar' }) as {
      props: { children: { props: { testID?: string } }[] };
    };

    const childTestIDs = rendered.props.children.map((child) => child.props.testID);

    expect(childTestIDs).toContain('action-bar-copy');
    expect(childTestIDs).toContain('action-bar-speak');
    expect(childTestIDs).toContain('action-bar-thumbs-down');
    expect(childTestIDs).toContain('action-bar-share');
    expect(childTestIDs).not.toContain('action-bar-more');
    expect(childTestIDs.length).toBe(4);
  });
});
