import { Check } from 'lucide-react-native';
import { type StyleProp, type ViewStyle } from 'react-native';

import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleFilterOption = 'Active' | 'Paused' | 'Completed';

export type ScheduleFilterDropdownProps = {
  selectedOption?: ScheduleFilterOption;
  onSelectOption?: (option: ScheduleFilterOption) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleFilterDropdown({
  selectedOption = 'Active',
  onSelectOption,
  style,
  testID = 'schedule-filter-dropdown',
}: ScheduleFilterDropdownProps) {
  const theme = useTheme();
  const options: ScheduleFilterOption[] = ['Active', 'Paused', 'Completed'];

  const items: DropdownMenuItem[] = options.map((opt) => ({
    id: opt,
    label: opt,
    icon:
      selectedOption === opt ? (
        <Check size={14} color={theme.text} strokeWidth={2.5} />
      ) : null,
    onPress: () => onSelectOption?.(opt),
  }));

  return <DropdownMenu items={items} style={style} testID={testID} />;
}
