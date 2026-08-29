import { Check } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SettingsTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  ACCENT_COLOR_OPTIONS,
  type AccentColorMode,
} from '../domain/theme/types';

export type AccentColorPickerDropdownProps = {
  selectedAccent: AccentColorMode | string;
  onSelectAccent: (accent: AccentColorMode) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AccentColorPickerDropdown({
  selectedAccent,
  onSelectAccent,
  style,
  testID = 'accent-color-picker-dropdown',
}: AccentColorPickerDropdownProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const normalizedSelected = selectedAccent.trim().toLowerCase();

  const items: DropdownMenuItem[] = ACCENT_COLOR_OPTIONS.map((option) => {
    const isSelected = normalizedSelected === option.id;
    const dotColor = colorScheme === 'dark' ? option.darkDot : option.lightDot;

    return {
      id: option.id,
      label: option.label,
      icon: (
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor },
          ]}
          testID={`${testID}-dot-${option.id}`}
        />
      ),
      rightAccessory: isSelected ? (
        <Check
          size={14}
          color={theme.linkPrimary}
          strokeWidth={2.5}
        />
      ) : null,
      onPress: () => onSelectAccent(option.id),
    };
  });

  return <DropdownMenu items={items} style={[styles.dropdown, style]} testID={testID} />;
}

const styles = StyleSheet.create({
  dropdown: {
    width: SettingsTokens.accentDropdown.width,
  },
  dot: {
    width: SettingsTokens.themeSection.accentDotSize,
    height: SettingsTokens.themeSection.accentDotSize,
    borderRadius: SettingsTokens.themeSection.accentDotRadius,
  },
});
