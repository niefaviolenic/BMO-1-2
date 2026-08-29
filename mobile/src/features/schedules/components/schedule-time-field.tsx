import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleTimeFieldProps = {
  timeValue?: string;
  onPressTime?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleTimeField({
  timeValue = 'Morning',
  onPressTime,
  style,
  testID = 'schedule-time-field',
}: ScheduleTimeFieldProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPressTime}
      accessibilityRole="button"
      accessibilityLabel="Time"
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
      <Text style={[styles.label, { color: theme.text }]}>Time</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.valueText, { color: theme.textSecondary }]}>{timeValue}</Text>
        <Text style={[styles.chevronIcon, { color: theme.textMuted }]}>⇕</Text>
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
});
