/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_HYDRATION_PROMPT,
  ScheduleHydrationCard,
} from './schedule-hydration-card';
import {
  DEFAULT_MORNING_PROMPT,
  ScheduleMorningCard,
} from './schedule-morning-card';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

vi.mock('react-native', () => ({
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('@/constants/theme', () => ({
  Colors: { light: {}, dark: {} },
  ScheduleTokens: {
    colors: {
      background: '#FFFFFF',
      border: '#E5E5EA',
      suggestionBorder: '#E0E5EB',
      textPrimary: '#1F1F24',
      textSecondary: '#66666E',
      blueAccent: '#007AFF',
      pausedTag: '#8E8E93',
      completedTag: '#34C759',
    },
    borderRadius: {
      card: 16,
      suggestionCard: 16,
    },
  },
}));

type RenderedCard = {
  props: {
    title?: string;
    description?: string;
    iconEmoji?: string;
    statusTag?: string;
    variant?: string;
  };
};
describe('Schedule Reminder Cards', () => {
  it('renders ScheduleHydrationCard with default reminder prompt and emoji', () => {
    const rendered = ScheduleHydrationCard({
      testID: 'hydration-card',
    }) as unknown as RenderedCard;

    expect(rendered.props.title).toBe('Hydration & Stretch');
    expect(rendered.props.description).toBe(DEFAULT_HYDRATION_PROMPT);
    expect(rendered.props.iconEmoji).toBe('💧');
    expect(rendered.props.statusTag).toBe('REMINDER');
    expect(rendered.props.variant).toBe('suggestion');
  });

  it('renders ScheduleMorningCard with default morning prompt and emoji', () => {
    const rendered = ScheduleMorningCard({
      testID: 'morning-card',
    }) as unknown as RenderedCard;

    expect(rendered.props.title).toBe('Morning Kickoff');
    expect(rendered.props.description).toBe(DEFAULT_MORNING_PROMPT);
    expect(rendered.props.iconEmoji).toBe('☀️');
    expect(rendered.props.statusTag).toBe('DAILY');
    expect(rendered.props.variant).toBe('suggestion');
  });
});
