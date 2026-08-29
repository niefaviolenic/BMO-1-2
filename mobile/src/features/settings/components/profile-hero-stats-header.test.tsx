// @ts-nocheck
/* eslint-disable import/no-unresolved */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ProfileHeroStatsHeader } from './profile-hero-stats-header';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

type RenderedMock = {
  props: MockComponentProps;
};

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

describe('ProfileHeroStatsHeader', () => {
  it('renders user row with UserAvatar and user info', () => {
    const rendered = ProfileHeroStatsHeader({
      name: 'Alex Rivers',
      planTag: 'PRO',
      streakSubtext: '42 Days Streak',
      totalDays: '941 Days',
      testID: 'stats-header',
    }) as unknown as RenderedMock;

    expect(rendered.props.testID).toBe('stats-header');

    const [userRow, statsRow] = rendered.props.children as unknown as [RenderedMock, RenderedMock];
    expect(userRow.props.testID).toBe('stats-header-user-row');
    expect(statsRow.props.testID).toBe('stats-header-stats-row');

    const [avatar, userInfoCol] = userRow.props.children as unknown as [RenderedMock, RenderedMock];
    expect(avatar.props.name).toBe('Alex Rivers');
    expect(avatar.props.testID).toBe('stats-header-avatar');
    expect(avatar.props.size).toBe(52);
    expect(userInfoCol.props.testID).toBe('stats-header-info-col');
  });

  it('passes avatarSource when provided', () => {
    const rendered = ProfileHeroStatsHeader({
      name: 'Alex Rivers',
      avatarSource: 'https://example.com/avatar.jpg',
      testID: 'stats-header',
    }) as unknown as RenderedMock;

    const [userRow] = rendered.props.children as unknown as [RenderedMock, RenderedMock];
    const [avatar] = userRow.props.children as unknown as [RenderedMock, RenderedMock];

    expect(avatar.props.name).toBe('Alex Rivers');
    expect(avatar.props.avatarUrl).toBe('https://example.com/avatar.jpg');
  });
});
