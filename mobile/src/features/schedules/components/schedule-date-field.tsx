import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleDateFieldProps = {
  dateValue?: string;
  onPressDate?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleDateField({
  dateValue = 'Thu, 15 Aug 2026',
  onPressDate,
  style,
  testID = 'schedule-date-field',
}: ScheduleDateFieldProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPressDate}
      accessibilityRole="button"
      accessibilityLabel="Date"
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: theme.text }]}>Date</Text>
      <View style={[styles.datePill, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.dateText, { color: theme.text }]}>{dateValue}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 362,
    height: 52,
    borderRadius: ScheduleTokens.borderRadius.field,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
