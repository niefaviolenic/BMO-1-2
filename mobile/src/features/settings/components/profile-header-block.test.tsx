// @ts-nocheck
/* eslint-disable import/no-unresolved */
import Module from 'module';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ProfileHeaderBlock } from './profile-header-block';

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

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ props }),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  Pressable: (props: MockComponentProps) => ({ props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ props }),
  View: (props: MockComponentProps) => ({ props }),
}));

vi.mock('@/components/ui/user-avatar', () => ({
  UserAvatar: (props: MockComponentProps) => ({ props }),
}));

describe('ProfileHeaderBlock', () => {
  it('renders with name and passes props to UserAvatar', () => {
    const rendered = ProfileHeaderBlock({
      name: 'Rangga Hadi Putra',
      testID: 'profile-header',
    }) as unknown as RenderedMock;

    expect(rendered.props.testID).toBe('profile-header');

    // Children are Pressable (avatar wrapper) and Text (name)
    const children = rendered.props.children as unknown as [RenderedMock, RenderedMock];
    const [avatarWrapper, nameText] = children;

    expect(nameText.props.children).toBe('Rangga Hadi Putra');

    const avatarChildren = avatarWrapper.props.children as unknown as [RenderedMock, RenderedMock];
    const [avatar, editBadge] = avatarChildren;

    expect(avatar.props.name).toBe('Rangga Hadi Putra');
    expect(avatar.props.testID).toBe('profile-header-avatar');
    expect(editBadge.props.testID).toBe('profile-header-edit-badge');
  });

  it('passes avatarSource when provided', () => {
    const rendered = ProfileHeaderBlock({
      name: 'Jane Doe',
      avatarSource: 'https://example.com/jane.png',
      testID: 'profile-header',
    }) as unknown as RenderedMock;

    const children = rendered.props.children as unknown as [RenderedMock, RenderedMock];
    const [avatarWrapper] = children;
    const avatarChildren = avatarWrapper.props.children as unknown as [RenderedMock, RenderedMock];
    const [avatar] = avatarChildren;

    expect(avatar.props.name).toBe('Jane Doe');
    expect(avatar.props.avatarUrl).toBe('https://example.com/jane.png');
  });
});
