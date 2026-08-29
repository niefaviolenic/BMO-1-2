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

import { Colors } from '@/constants/theme';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};

let mockCurrentTheme = Colors.light;

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => mockCurrentTheme,
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

import { ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react-native';

vi.mock('lucide-react-native', () => ({
  Plus: (props: MockComponentProps) => ({ type: 'Plus', props }),
  Trash2: (props: MockComponentProps) => ({ type: 'Trash2', props }),
  ChevronRight: (props: MockComponentProps) => ({ type: 'ChevronRight', props }),
  MoreHorizontal: (props: MockComponentProps) => ({ type: 'MoreHorizontal', props }),
}));

import { PluginItemRow } from './plugin-item-row';

function findElementByTestID(tree: unknown, testID: string): any {
  if (!tree || typeof tree !== 'object') {
    return null;
  }
  const node = tree as { props?: { testID?: string; children?: unknown } };
  if (node.props?.testID === testID) {
    return node;
  }
  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElementByTestID(child, testID);
      if (match) {
        return match;
      }
    }
  } else if (children) {
    return findElementByTestID(children, testID);
  }
  return null;
}

describe('PluginItemRow', () => {
  beforeEach(() => {
    mockCurrentTheme = Colors.light;
  });

  it('renders add action icon when actionType is add and not loading', () => {
    const onActionPress = vi.fn();
    const tree = PluginItemRow({
      title: 'WhatsApp',
      description: 'Messaging',
      actionType: 'add',
      onActionPress,
      testID: 'test-row',
    });

    const actionButton = findElementByTestID(tree, 'test-row-action-button');
    expect(actionButton).toBeTruthy();
    expect(actionButton.props.disabled).toBeFalsy();

    const actionChildren = actionButton.props.children;
    expect(actionChildren.type).toBe(Plus);
  });

  it('renders trash action icon when actionType is trash and not loading', () => {
    const onActionPress = vi.fn();
    const tree = PluginItemRow({
      title: 'WhatsApp',
      description: 'Messaging',
      actionType: 'trash',
      onActionPress,
      testID: 'test-row',
    });

    const actionButton = findElementByTestID(tree, 'test-row-action-button');
    expect(actionButton).toBeTruthy();

    const actionChildren = actionButton.props.children;
    expect(actionChildren.type).toBe(Trash2);
  });

  it('renders ActivityIndicator and disables action button when isLoading is true', () => {
    const onActionPress = vi.fn();
    const tree = PluginItemRow({
      title: 'WhatsApp',
      description: 'Messaging',
      actionType: 'add',
      isLoading: true,
      onActionPress,
      testID: 'test-row',
    });

    const actionButton = findElementByTestID(tree, 'test-row-action-button');
    expect(actionButton).toBeTruthy();
    expect(actionButton.props.disabled).toBe(true);

    const spinner = findElementByTestID(tree, 'test-row-spinner');
    expect(spinner).toBeTruthy();
  });
});
