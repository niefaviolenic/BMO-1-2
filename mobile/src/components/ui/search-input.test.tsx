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

vi.mock('expo-image', () => ({
  Image: (props: unknown) => ({ type: 'Image', props }),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  TextInput: (props: unknown) => ({ type: 'TextInput', props }),
  View: (props: unknown) => ({ type: 'View', props }),
  Pressable: (props: { onPress?: () => void; children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode) }) => {
    const children = typeof props.children === 'function' ? props.children({ pressed: false }) : props.children;
    return { type: 'Pressable', props: { ...props, children } };
  },
}));

import { Colors } from '@/constants/theme';
import { SearchInput } from './search-input';

let mockCurrentTheme = Colors.light;

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => mockCurrentTheme,
}));

describe('SearchInput', () => {
  beforeEach(() => {
    mockCurrentTheme = Colors.light;
  });

  it('renders search input with placeholder and search icon', () => {
    const rendered = SearchInput({ placeholder: 'Search plugins...' });
    expect(rendered).toBeDefined();
    expect(rendered.props).toBeDefined();

    const searchIcon = rendered.props.children[0];
    expect(searchIcon.props.accessibilityLabel).toBe('Search');
    expect(searchIcon.props.tintColor).toBe(Colors.light.textMuted);

    const textInput = rendered.props.children[1];
    expect(textInput.props.placeholder).toBe('Search plugins...');
  });

  it('does not render clear button when value is empty or undefined', () => {
    const rendered = SearchInput({ value: '' });
    const clearButton = rendered.props.children[2];
    expect(clearButton).toBeNull();
  });

  it('renders clear button without tintColor on clear icon when value is provided', () => {
    const rendered = SearchInput({ value: 'hello' });
    const clearButton = rendered.props.children[2];
    expect(clearButton).toBeDefined();
    expect(clearButton.props.accessibilityLabel).toBe('Clear search');

    const clearIcon = typeof clearButton.props.children === 'function'
      ? clearButton.props.children({ pressed: false })
      : clearButton.props.children;
    expect(clearIcon.props.style).toBeDefined();
    // Crucial: tintColor must be undefined so multi-color SVG (gray circle + white X) renders properly
    expect(clearIcon.props.tintColor).toBeUndefined();
  });

  it('triggers onChangeText with empty string and onClear when clear button is pressed', () => {
    const onChangeText = vi.fn();
    const onClear = vi.fn();
    const rendered = SearchInput({ value: 'hello', onChangeText, onClear });
    const clearButton = rendered.props.children[2];

    clearButton.props.onPress();
    expect(onChangeText).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });
});
