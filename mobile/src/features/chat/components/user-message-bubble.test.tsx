/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import Module from 'module';
// @ts-ignore
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { UserMessageBubble } from './user-message-bubble';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

beforeAll(() => {
  const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
  const originalRequire = moduleProto.require;
  moduleProto.require = function (this: unknown, id: string): unknown {
    if (typeof id === 'string' && id.includes('icon-joy-robot.svg')) {
      return 'mocked-icon-joy-robot.svg';
    }
    return originalRequire.call(this, id);
  };
});

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('@/constants/theme', () => ({
  Colors: { light: {}, dark: {} },
  UserMessageBubbleTokens: {
    background: '#F1F1F1',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    textColor: '#18181B',
    fontSize: 14,
  },
}));

describe('UserMessageBubble', () => {
  it('renders without robot badge when sourceDeviceId is null or undefined (mobile input)', () => {
    const element = UserMessageBubble({
      message: 'Hello from mobile keyboard',
      sourceDeviceId: null,
      testID: 'bubble-test',
    });

    expect(element.props.testID).toBe('bubble-test');
    // First child is null (no robotHeader)
    expect(element.props.children[0]).toBeNull();
    // Second child is the text element
    expect(element.props.children[1].props.children).toBe('Hello from mobile keyboard');
  });

  it('renders with robot badge when sourceDeviceId is present (hardware robot input)', () => {
    const element = UserMessageBubble({
      message: 'Halo Joy robot dari suara',
      sourceDeviceId: '00000000-0000-4000-8000-000000000088',
      testID: 'bubble-test',
    });

    expect(element.props.testID).toBe('bubble-test');
    // First child is the robotHeader view
    const robotHeader = element.props.children[0];
    expect(robotHeader).not.toBeNull();
    expect(robotHeader.props.testID).toBe('bubble-test-robot-badge');
    expect(robotHeader.props.children[1].props.children).toBe('via Joy Robot');
    // Second child is the text element
    expect(element.props.children[1].props.children).toBe('Halo Joy robot dari suara');
  });
});
