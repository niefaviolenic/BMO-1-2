import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CheckmarkButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CheckmarkButton({
  onPress,
  disabled = false,
  style,
  testID = 'checkmark-button',
}: CheckmarkButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Confirm"
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.buttonPrimaryBackground },
        disabled && styles.disabled,
        style,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.checkmark, { color: theme.buttonPrimaryText }]}>✓</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: ScheduleTokens.borderRadius.checkmark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
});
