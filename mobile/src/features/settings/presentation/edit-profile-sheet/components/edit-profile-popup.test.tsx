// @ts-nocheck
/* eslint-disable import/no-unresolved, import/first */
import Module from 'module';
import React from 'react';
import type * as ReactType from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EditProfilePopupTokens as Tokens } from '@/constants/theme';

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

beforeAll(() => {
  const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
  const originalRequire = moduleProto.require;
  moduleProto.require = function (this: unknown, id: string): unknown {
    if (typeof id === 'string' && (id.endsWith('.svg') || id.endsWith('.png'))) {
      return 'mocked-asset';
    }
    return originalRequire.call(this, id);
  };
});

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

type RenderedMock = {
  props: MockComponentProps;
};

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactType>('react');
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useMemo: vi.fn((fn: () => unknown) => fn()),
    useCallback: vi.fn((fn: unknown) => fn),
  };
});

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ props }),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: (props: MockComponentProps) => ({ props }),
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  Pressable: (props: MockComponentProps) => ({ props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ props }),
  TextInput: (props: MockComponentProps) => ({ props }),
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: (props: MockComponentProps) => ({ props }),
}));

vi.mock('@/components/ui/user-avatar', () => ({
  UserAvatar: (props: MockComponentProps) => ({ props }),
}));

import { EditProfilePopup } from './edit-profile-popup';

describe('EditProfilePopup', () => {
  it('renders UserAvatar with name and size tokens', () => {
    const rendered = EditProfilePopup({
      name: 'Rangga Hadi Putra',
      username: 'ranggabiner',
      testID: 'edit-popup',
    }) as unknown as RenderedMock;

    expect(rendered.props.testID).toBe('edit-popup');

    const children = rendered.props.children as unknown as RenderedMock[];
    const [avatarPressable] = children;
    expect(avatarPressable.props.testID).toBe('edit-popup-avatar-wrapper');

    const avatarChildren = avatarPressable.props.children as unknown as [RenderedMock, RenderedMock];
    const [avatar, cameraBadge] = avatarChildren;

    expect(avatar.props.name).toBe('Rangga Hadi Putra');
    expect(avatar.props.testID).toBe('edit-popup-avatar');
    expect(avatar.props.size).toBe(Tokens.avatarSize);
    expect(cameraBadge.props.testID).toBe('edit-popup-camera-badge');
  });

  it('passes avatarUri to UserAvatar when provided', () => {
    const rendered = EditProfilePopup({
      name: 'Rangga Hadi Putra',
      avatarUri: 'file:///cache/new-photo.jpg',
      testID: 'edit-popup',
    }) as unknown as RenderedMock;

    const children = rendered.props.children as unknown as RenderedMock[];
    const [avatarPressable] = children;
    const [avatar] = avatarPressable.props.children as unknown as [RenderedMock, RenderedMock];

    expect(avatar.props.avatarUrl).toBe('file:///cache/new-photo.jpg');
  });
});
