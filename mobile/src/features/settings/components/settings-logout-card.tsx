import { LogOut } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

const tokens = SettingsTokens.logoutCard;

export type SettingsLogoutCardProps = {
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SettingsLogoutCard({
  label = 'Log out',
  onPress,
  style,
  testID = 'settings-logout-card',
}: SettingsLogoutCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
        testID={`${testID}-row`}
        style={({ pressed }) => [
          styles.row,
          onPress && pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
        ]}
      >
        <LogOut
          size={tokens.iconSize}
          color="#EF4444"
          strokeWidth={tokens.iconStrokeWidth}
        />
        <Text style={[styles.label, { color: '#EF4444' }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: tokens.cardRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    height: tokens.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.rowGap,
    paddingHorizontal: tokens.rowPaddingHorizontal,
  },
  rowPressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
  },
});
