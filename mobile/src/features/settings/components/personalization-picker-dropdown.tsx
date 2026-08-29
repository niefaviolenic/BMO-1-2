import { Check } from 'lucide-react-native';
import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
export type PersonalizationPickerDropdownProps = {
  options: readonly string[];
  selectedOption: string;
  onSelectOption: (option: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function formatOptionLabel(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PersonalizationPickerDropdown({
  options,
  selectedOption,
  onSelectOption,
  style,
  testID = 'personalization-picker-dropdown',
}: PersonalizationPickerDropdownProps) {
  const theme = useTheme();

  const items: DropdownMenuItem[] = options.map((opt) => {
    const isSelected =
      selectedOption.trim().toLowerCase() === opt.trim().toLowerCase();
    return {
      id: opt,
      label: formatOptionLabel(opt),
      icon: isSelected ? (
        <Check
          size={14}
          color={theme.text}
          strokeWidth={2.5}
        />
      ) : null,
      onPress: () => onSelectOption(opt),
    };
  });
  return <DropdownMenu items={items} style={style} testID={testID} />;
}
