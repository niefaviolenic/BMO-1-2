import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DayOfWeek =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type ScheduleDaysSelectionFieldProps = {
  selectedDays?: DayOfWeek[];
  onToggleDay?: (day: DayOfWeek) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const ALL_DAYS: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function ScheduleDaysSelectionField({
  selectedDays = ['Thursday'],
  onToggleDay,
  style,
  testID = 'schedule-days-selection-field',
}: ScheduleDaysSelectionFieldProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      {ALL_DAYS.map((day, index) => {
        const isSelected = selectedDays.includes(day);
        const isLast = index === ALL_DAYS.length - 1;

        return (
          <View key={day}>
            <Pressable
              onPress={() => onToggleDay?.(day)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={day}
              testID={`${testID}-day-${day}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.dayLabel, { color: theme.text }]}>{day}</Text>
              {isSelected ? <Text style={[styles.checkmark, { color: theme.text }]}>✓</Text> : null}
            </Pressable>
            {!isLast ? <View style={[styles.divider, { backgroundColor: theme.divider }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 362,
    borderRadius: ScheduleTokens.borderRadius.field,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  row: {
    height: 49,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
});
