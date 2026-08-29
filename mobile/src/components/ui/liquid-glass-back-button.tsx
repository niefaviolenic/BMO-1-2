import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassIconButton } from './liquid-glass-icon-button';

export type LiquidGlassBackButtonProps = {
  onPress: () => void;
  testID?: string;
  size?: number;
  iconColor?: string;
};

export function LiquidGlassBackButton({
  onPress,
  testID = 'liquid-glass-back-button',
  size = 40,
  iconColor,
}: LiquidGlassBackButtonProps) {
  const theme = useTheme();
  const resolvedIconColor = iconColor ?? theme.icon;

  return (
    <LiquidGlassIconButton
      onPress={onPress}
      size={size}
      accessibilityLabel="Back"
      testID={testID}
    >
      <Image
        source={require('@/assets/images/auth/back-icon.svg')}
        style={styles.icon}
        contentFit="contain"
        tintColor={resolvedIconColor}
        accessibilityLabel="Back"
      />
    </LiquidGlassIconButton>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 20,
    height: 20,
  },
});
