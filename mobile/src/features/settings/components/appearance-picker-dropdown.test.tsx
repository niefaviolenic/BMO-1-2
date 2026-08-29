// @ts-nocheck
/* eslint-disable import/no-unresolved, import/first */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  Appearance: {
    getColorScheme: () => 'light',
    setColorScheme: vi.fn(),
    addChangeListener: () => ({ remove: () => {} }),
  },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('lucide-react-native', () => ({
  Check: (props: MockComponentProps) => ({ type: 'Check', props }),
}));
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    linkPrimary: '#007AFF',
    text: '#000000',
  }),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));


import type { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AppearancePickerDropdown } from './appearance-picker-dropdown';

type RenderedDropdown = {
  props: {
    items: DropdownMenuItem[];
    testID?: string;
  };
};

describe('AppearancePickerDropdown', () => {
  it('renders all appearance options: System, Dark, Light', () => {
    const onSelect = vi.fn();
    const rendered = AppearancePickerDropdown({
      selectedAppearance: 'system',
      onSelectAppearance: onSelect,
      testID: 'test-picker',
    }) as unknown as RenderedDropdown;

    expect(rendered.props.items).toHaveLength(3);
    expect(rendered.props.items[0].label).toBe('System');
    expect(rendered.props.items[1].label).toBe('Dark');
    expect(rendered.props.items[2].label).toBe('Light');
  });

  it('marks selected item with check icon', () => {
    const onSelect = vi.fn();
    const rendered = AppearancePickerDropdown({
      selectedAppearance: 'dark',
      onSelectAppearance: onSelect,
    }) as unknown as RenderedDropdown;

    expect(rendered.props.items[0].icon).toBeNull();
    expect(rendered.props.items[1].icon).not.toBeNull();
    expect(rendered.props.items[2].icon).toBeNull();
  });

  it('triggers onSelectAppearance when item is pressed', () => {
    const onSelect = vi.fn();
    const rendered = AppearancePickerDropdown({
      selectedAppearance: 'system',
      onSelectAppearance: onSelect,
    }) as unknown as RenderedDropdown;

    rendered.props.items[1].onPress();
    expect(onSelect).toHaveBeenCalledWith('dark');

    rendered.props.items[2].onPress();
    expect(onSelect).toHaveBeenCalledWith('light');

    rendered.props.items[0].onPress();
    expect(onSelect).toHaveBeenCalledWith('system');
  });
});
