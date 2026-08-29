import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PluginsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PluginPermissionsCardProps = {
  /** Label shown on the left side of the card. Defaults to "Permissions". */
  label?: string;
  /** Value shown on the right side of the card. Defaults to "Allow low-risk". */
  value?: string;
  /** Callback fired when the card is pressed. */
  onPress?: () => void;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PluginPermissionsCard({
  label = 'Permissions',
  value = 'Allow low-risk',
  onPress,
  style,
  testID = 'plugin-permissions-card',
}: PluginPermissionsCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.cardBackground },
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <Text
        style={[styles.labelText, { color: theme.text }]}
        numberOfLines={1}
        testID={`${testID}-label`}
      >
        {label}
      </Text>

      <View style={styles.rightGroup} testID={`${testID}-right`}>
        <Text
          style={[styles.valueText, { color: theme.textSecondary }]}
          numberOfLines={1}
          testID={`${testID}-value`}
        >
          {value}
        </Text>

        <ChevronRight
          size={PluginsTokens.permissionsCard.chevronSize}
          color={theme.textSecondary}
          testID={`${testID}-chevron`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PluginsTokens.permissionsCard.width,
    maxWidth: '100%',
    height: PluginsTokens.permissionsCard.height,
    borderRadius: PluginsTokens.permissionsCard.cardRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PluginsTokens.permissionsCard.paddingHorizontal,
  },
  cardPressed: {
    opacity: 0.7,
  },
  labelText: {
    fontSize: PluginsTokens.permissionsCard.labelFontSize,
    fontWeight: '400',
    lineHeight: PluginsTokens.permissionsCard.labelLineHeight,
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PluginsTokens.permissionsCard.rightGap,
  },
  valueText: {
    fontSize: PluginsTokens.permissionsCard.valueFontSize,
    fontWeight: '400',
    lineHeight: PluginsTokens.permissionsCard.valueLineHeight,
  },
});
