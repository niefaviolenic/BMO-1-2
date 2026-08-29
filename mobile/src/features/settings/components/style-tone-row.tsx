import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';
export type StyleToneRowProps = {
  /** The left row label text. Defaults to "Base style and tone" */
  label?: string;
  /** The selected style/tone value displayed on the right. Defaults to "Efficient & Direct" */
  value?: string;
  /** Callback fired when the row or value selector is pressed */
  onPress?: () => void;
  /** Optional callback when row layout is measured */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Optional style override for container */
  style?: StyleProp<ViewStyle>;
  /** Test identifier for testing frameworks */
  testID?: string;
};

export function StyleToneRow({
  label = 'Base style and tone',
  value = 'Efficient & Direct',
  onPress,
  onLayout,
  style,
  testID = 'style-tone-row',
}: StyleToneRowProps) {
  const theme = useTheme();

  const selectorContent = (
    <>
      <Text
        style={[styles.valueText, { color: theme.textSecondary }]}
        numberOfLines={1}
        testID={`${testID}-value`}
      >
        {value}
      </Text>
      <Image
        source={require('@/assets/images/ui/icon-chevrons-up-down.svg')}
        style={styles.chevronIcon}
        tintColor={theme.textMuted}
        contentFit="contain"
        testID={`${testID}-icon`}
      />
    </>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.cardBackground },
        style,
      ]}
      onLayout={onLayout}
      testID={testID}
    >
      <Text
        style={[styles.labelText, { color: theme.text }]}
        numberOfLines={1}
        testID={`${testID}-label`}
      >
        {label}
      </Text>
      {onPress ? (
        <Pressable
          style={({ pressed }) => [
            styles.valueSelector,
            pressed && styles.pressed,
          ]}
          onPress={onPress}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 8 }}
          testID={`${testID}-selector`}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${value}`}
        >
          {selectorContent}
        </Pressable>
      ) : (
        <View style={styles.valueSelector} testID={`${testID}-selector`}>
          {selectorContent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: SettingsTokens.styleToneRow.width,
    height: SettingsTokens.styleToneRow.height,
    backgroundColor: SettingsTokens.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SettingsTokens.styleToneRow.paddingHorizontal,
    paddingVertical: SettingsTokens.styleToneRow.paddingVertical,
  },
  pressed: {
    opacity: 0.7,
  },
  labelText: {
    flexShrink: 1,
    fontSize: SettingsTokens.styleToneRow.labelFontSize,
    fontWeight: '400',
    color: SettingsTokens.colors.textPrimary,
    lineHeight: 18,
  },
  valueSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: SettingsTokens.styleToneRow.valueSelectorGap,
  },
  valueText: {
    fontSize: SettingsTokens.styleToneRow.valueFontSize,
    fontWeight: '400',
    color: SettingsTokens.colors.textSecondary,
    lineHeight: 18,
  },
  chevronIcon: {
    width: SettingsTokens.styleToneRow.iconSize,
    height: SettingsTokens.styleToneRow.iconSize,
  },
});
