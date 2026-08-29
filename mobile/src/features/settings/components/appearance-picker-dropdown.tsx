import { Check } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SettingsTokens } from '@/constants/theme';
import {
  APPEARANCE_OPTIONS,
  type AppearanceMode,
} from '../domain/theme/types';

export type AppearancePickerDropdownProps = {
  selectedAppearance: AppearanceMode | string;
  onSelectAppearance: (appearance: AppearanceMode) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AppearancePickerDropdown({
  selectedAppearance,
  onSelectAppearance,
  style,
  testID = 'appearance-picker-dropdown',
}: AppearancePickerDropdownProps) {
  const theme = useTheme();
  const normalizedSelected = selectedAppearance.trim().toLowerCase();

  const items: DropdownMenuItem[] = APPEARANCE_OPTIONS.map((option) => {
    const isSelected = normalizedSelected === option.id;
    return {
      id: option.id,
      label: option.label,
      icon: isSelected ? (
        <Check
          size={14}
          color={theme.linkPrimary}
          strokeWidth={2.5}
        />
      ) : null,
      onPress: () => onSelectAppearance(option.id),
    };
  });

  return <DropdownMenu items={items} style={[styles.dropdown, style]} testID={testID} />;
}

const styles = StyleSheet.create({
  dropdown: {
    width: SettingsTokens.appearanceDropdown.width,
  },
});
