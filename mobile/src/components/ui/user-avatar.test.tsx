// @ts-nocheck
/* eslint-disable import/no-unresolved */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAvatarColor } from '@/features/auth/domain/avatar';

import { UserAvatar } from './user-avatar';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  source?: unknown;
  style?: unknown;
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
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ props }),
  View: (props: MockComponentProps) => ({ props }),
}));

describe('UserAvatar', () => {
  it('renders initials and deterministic background when avatarUrl is not provided', () => {
    const rendered = UserAvatar({
      name: 'Rangga Hadi Putra',
      testID: 'test-avatar',
    }) as unknown as RenderedMock;

    expect(rendered.props.testID).toBe('test-avatar');

    const expectedBg = getAvatarColor('Rangga Hadi Putra');
    expect(rendered.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: expectedBg,
        }),
      ]),
    );

    const children = rendered.props.children as unknown as RenderedMock;
    expect(children.props.testID).toBe('test-avatar-initials');
    expect(children.props.children).toBe('RP');
  });

  it('renders single-word 2-letter initials', () => {
    const rendered = UserAvatar({
      name: 'Rangga',
      testID: 'test-avatar',
    }) as unknown as RenderedMock;

    const children = rendered.props.children as unknown as RenderedMock;
    expect(children.props.children).toBe('RA');
  });

  it('renders fallback initial when name is null or undefined', () => {
    const rendered = UserAvatar({
      name: null,
      testID: 'test-avatar',
    }) as unknown as RenderedMock;

    const children = rendered.props.children as unknown as RenderedMock;
    expect(children.props.children).toBe('U');
  });

  it('renders Image when valid avatarUrl string is provided', () => {
    const rendered = UserAvatar({
      name: 'Rangga Hadi Putra',
      avatarUrl: 'https://example.com/avatar.png',
      testID: 'test-avatar',
    }) as unknown as RenderedMock;

    const image = rendered.props.children as unknown as RenderedMock;
    expect(image.props.testID).toBe('test-avatar-image');
    expect(image.props.source).toEqual({ uri: 'https://example.com/avatar.png' });
  });

  it('renders Image when local number source is provided', () => {
    const rendered = UserAvatar({
      name: 'Rangga Hadi Putra',
      avatarUrl: 12345,
      testID: 'test-avatar',
    }) as unknown as RenderedMock;

    const image = rendered.props.children as unknown as RenderedMock;
    expect(image.props.testID).toBe('test-avatar-image');
    expect(image.props.source).toBe(12345);
  });

  it('applies custom size, radius, and custom backgroundColor overrides', () => {
    const rendered = UserAvatar({
      name: 'Alex Rivers',
      size: 52,
      radius: 26,
      fontSize: 18,
      backgroundColor: '#123456',
      textColor: '#FAFAFA',
      testID: 'custom-avatar',
    }) as unknown as RenderedMock;

    expect(rendered.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#123456',
        }),
      ]),
    );

    const initials = rendered.props.children as unknown as RenderedMock;
    expect(initials.props.children).toBe('AR');
    expect(initials.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 18,
          color: '#FAFAFA',
        }),
      ]),
    );
  });
});
