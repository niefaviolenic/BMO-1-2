import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassIconButton } from './liquid-glass-icon-button';

export type LiquidGlassCloseButtonProps = {
  onPress: () => void;
  testID?: string;
  size?: number;
  iconColor?: string;
};

export function LiquidGlassCloseButton({
  onPress,
  testID,
  size = 40,
  iconColor,
}: LiquidGlassCloseButtonProps) {
  const theme = useTheme();
  const resolvedIconColor = iconColor ?? theme.text;

  return (
    <LiquidGlassIconButton
      onPress={onPress}
      size={size}
      accessibilityLabel="Close"
      testID={testID}
    >
      <Text style={[styles.closeIconText, { color: resolvedIconColor }]}>✕</Text>
    </LiquidGlassIconButton>
  );
}

const styles = StyleSheet.create({
  closeIconText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
