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
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { PluginConnectSheet } from './plugin-connect-sheet';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
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
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({
    type: 'ModalBottomSheet',
    props,
  }),
}));

vi.mock('./plugin-connect-logos-row', () => ({
  PluginConnectLogosRow: (props: MockComponentProps) => ({
    type: 'PluginConnectLogosRow',
    props,
  }),
}));

vi.mock('./plugin-policy-container', () => ({
  PluginPolicyContainer: (props: MockComponentProps) => ({
    type: 'PluginPolicyContainer',
    props,
  }),
}));

function findElementByTestID(tree: unknown, testID: string): any {
  if (!tree || typeof tree !== 'object') {
    return null;
  }

  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findElementByTestID(child, testID);
      if (match) return match;
    }
    return null;
  }

  const node = tree as { props?: { testID?: string; children?: unknown } };
  if (node.props?.testID === testID) {
    return node;
  }

  if (node.props?.children) {
    return findElementByTestID(node.props.children, testID);
  }

  return null;
}

describe('PluginConnectSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentTheme = Colors.light;
  });

  it('renders modal bottom sheet when isVisible is true', () => {
    const tree = PluginConnectSheet({
      isVisible: true,
      onClose: vi.fn(),
      pluginTitle: 'WhatsApp',
    });

    expect(tree.type).toBe(ModalBottomSheet);
    expect(tree.props.isVisible).toBe(true);
  });

  it('calls both onConnect and onClose when setup button is pressed', () => {
    const handleClose = vi.fn();
    const handleConnect = vi.fn();

    const tree = PluginConnectSheet({
      isVisible: true,
      onClose: handleClose,
      onConnect: handleConnect,
      pluginTitle: 'WhatsApp',
      testID: 'test-sheet',
    });

    const setupButton = findElementByTestID(tree, 'test-sheet-setup-button');
    expect(setupButton).not.toBeNull();
    expect(setupButton.props.onPress).toBeDefined();

    setupButton.props.onPress();

    expect(handleConnect).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('handles setup button press gracefully when onConnect is undefined', () => {
    const handleClose = vi.fn();

    const tree = PluginConnectSheet({
      isVisible: true,
      onClose: handleClose,
      pluginTitle: 'Spotify',
      testID: 'test-sheet',
    });

    const setupButton = findElementByTestID(tree, 'test-sheet-setup-button');
    expect(setupButton).not.toBeNull();

    expect(() => {
      setupButton.props.onPress();
    }).not.toThrow();

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
