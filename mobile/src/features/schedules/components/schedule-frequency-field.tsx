import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleFrequencyFieldProps = {
  frequencyValue?: string;
  everyValue?: string | number;
  onPressFrequency?: () => void;
  onPressEvery?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleFrequencyField({
  frequencyValue = 'Weekly',
  everyValue = '1',
  onPressFrequency,
  onPressEvery,
  style,
  testID = 'schedule-frequency-field',
}: ScheduleFrequencyFieldProps) {
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
      {/* Frequency Row */}
      <Pressable
        onPress={onPressFrequency}
        accessibilityRole="button"
        accessibilityLabel="Frequency"
        testID={`${testID}-frequency`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: theme.text }]}>Frequency</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.valueText, { color: theme.textSecondary }]}>{frequencyValue}</Text>
          <Text style={[styles.chevronIcon, { color: theme.textMuted }]}>⇕</Text>
        </View>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: theme.divider }]} />

      {/* Every Row */}
      <Pressable
        onPress={onPressEvery}
        accessibilityRole="button"
        accessibilityLabel="Every"
        testID={`${testID}-every`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: theme.text }]}>Every</Text>
        <Text style={[styles.boldValueText, { color: theme.text }]}>{everyValue}</Text>
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
    fontSize: 14,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '400',
  },
  boldValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chevronIcon: {
    fontSize: 12,
  },
  divider: {
    height: 1,
  },
});
