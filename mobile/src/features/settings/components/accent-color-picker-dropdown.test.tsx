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
vi.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));

import type { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AccentColorPickerDropdown } from './accent-color-picker-dropdown';

type RenderedDropdown = {
  props: {
    items: DropdownMenuItem[];
    testID?: string;
  };
};

describe('AccentColorPickerDropdown', () => {
  it('renders all accent options: Default, Purple, Green, Orange, Pink', () => {
    const onSelect = vi.fn();
    const rendered = AccentColorPickerDropdown({
      selectedAccent: 'default',
      onSelectAccent: onSelect,
      testID: 'test-accent-picker',
    }) as unknown as RenderedDropdown;

    expect(rendered.props.items).toHaveLength(5);
    expect(rendered.props.items[0].label).toBe('Default');
    expect(rendered.props.items[1].label).toBe('Purple');
    expect(rendered.props.items[2].label).toBe('Green');
    expect(rendered.props.items[3].label).toBe('Orange');
    expect(rendered.props.items[4].label).toBe('Pink');
  });

  it('marks selected item with check right accessory', () => {
    const onSelect = vi.fn();
    const rendered = AccentColorPickerDropdown({
      selectedAccent: 'purple',
      onSelectAccent: onSelect,
    }) as unknown as RenderedDropdown;

    expect(rendered.props.items[0].rightAccessory).toBeNull();
    expect(rendered.props.items[1].rightAccessory).not.toBeNull();
    expect(rendered.props.items[2].rightAccessory).toBeNull();
  });

  it('triggers onSelectAccent when item is pressed', () => {
    const onSelect = vi.fn();
    const rendered = AccentColorPickerDropdown({
      selectedAccent: 'default',
      onSelectAccent: onSelect,
    }) as unknown as RenderedDropdown;

    rendered.props.items[1].onPress();
    expect(onSelect).toHaveBeenCalledWith('purple');

    rendered.props.items[2].onPress();
    expect(onSelect).toHaveBeenCalledWith('green');
  });
});
