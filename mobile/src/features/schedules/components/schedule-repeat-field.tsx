import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleRepeatFieldProps = {
  repeatFrequency?: string;
  repeatDay?: string;
  onPressFrequency?: () => void;
  onPressDay?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleRepeatField({
  repeatFrequency = 'Weekly',
  repeatDay = 'Thursdays',
  onPressFrequency,
  onPressDay,
  style,
  testID = 'schedule-repeat-field',
}: ScheduleRepeatFieldProps) {
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
      {/* Row 1: Repeat Frequency */}
      <Pressable
        onPress={onPressFrequency}
        accessibilityRole="button"
        accessibilityLabel="Repeat frequency"
        testID={`${testID}-frequency`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: theme.text }]}>Repeat</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.valueText, { color: theme.textSecondary }]}>{repeatFrequency}</Text>
          <Text style={[styles.chevronIcon, { color: theme.textMuted }]}>⇕</Text>
        </View>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: theme.divider }]} />

      {/* Row 2: Repeat Day */}
      <Pressable
        onPress={onPressDay}
        accessibilityRole="button"
        accessibilityLabel="Repeat day"
        testID={`${testID}-day`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: theme.text }]}>{repeatDay}</Text>
        <Text style={[styles.rightChevron, { color: theme.textMuted }]}>›</Text>
      </Pressable>
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
    height: 51,
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
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '400',
  },
  chevronIcon: {
    fontSize: 12,
  },
  rightChevron: {
    fontSize: 20,
    fontWeight: '300',
  },
  divider: {
    height: 1,
  },
});
