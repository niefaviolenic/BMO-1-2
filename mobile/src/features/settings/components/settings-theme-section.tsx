import { Image } from 'expo-image';
import { Palette, Sun } from 'lucide-react-native';
import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

const tokens = SettingsTokens.themeSection;
const CHEVRONS_ICON = require('@/assets/images/ui/icon-chevrons-up-down.svg');

export type SettingsThemeSectionProps = {
  title?: string;
  appearanceValue?: string;
  accentColorLabel?: string;
  accentColorDot?: string;
  onAppearancePress?: (anchor?: { y: number; height: number }) => void;
  onAccentColorPress?: (anchor?: { y: number; height: number }) => void;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

export function SettingsThemeSection({
  title = 'Theme',
  appearanceValue = 'System',
  accentColorLabel = 'Default',
  accentColorDot,
  onAppearancePress,
  onAccentColorPress,
  style,
  onLayout,
  testID = 'settings-theme-section',
}: SettingsThemeSectionProps) {
  const theme = useTheme();
  const appearanceRowRef = useRef<View>(null);
  const accentRowRef = useRef<View>(null);
  const resolvedAccentDot = accentColorDot ?? theme.accentDot;

  const handleAppearancePress = () => {
    if (!onAppearancePress) return;
    if (appearanceRowRef.current?.measureInWindow) {
      appearanceRowRef.current.measureInWindow((_x, y, _width, height) => {
        onAppearancePress({ y, height });
      });
    } else {
      onAppearancePress();
    }
  };

  const handleAccentColorPress = () => {
    if (!onAccentColorPress) return;
    if (accentRowRef.current?.measureInWindow) {
      accentRowRef.current.measureInWindow((_x, y, _width, height) => {
        onAccentColorPress({ y, height });
      });
    } else {
      onAccentColorPress();
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={onLayout} testID={testID}>
      {title ? (
        <View style={styles.headerFrame}>
          <Text style={[styles.headerText, { color: theme.textMuted }]}>{title}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Row 1: Appearance */}
        <View
          ref={appearanceRowRef}
          collapsable={false}
          style={styles.row}
          testID={`${testID}-appearance-row`}
        >
          <Sun
            size={tokens.iconSize}
            color={theme.icon}
            strokeWidth={tokens.iconStrokeWidth}
          />
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            Appearance
          </Text>
          {onAppearancePress ? (
            <Pressable
              onPress={handleAppearancePress}
              accessibilityRole="button"
              accessibilityLabel={`Appearance, currently ${appearanceValue}`}
              testID={`${testID}-appearance-selector`}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 8 }}
              style={({ pressed }) => [
                styles.valueSelector,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
                {appearanceValue}
              </Text>
              <Image
                source={CHEVRONS_ICON}
                style={styles.chevron}
                tintColor={theme.textMuted}
                contentFit="contain"
              />
            </Pressable>
          ) : (
            <View style={styles.valueSelector} testID={`${testID}-appearance-selector`}>
              <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
                {appearanceValue}
              </Text>
              <Image
                source={CHEVRONS_ICON}
                style={styles.chevron}
                tintColor={theme.textMuted}
                contentFit="contain"
              />
            </View>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Row 2: Accent Color */}
        <View
          ref={accentRowRef}
          collapsable={false}
          style={styles.row}
          testID={`${testID}-accent-color-row`}
        >
          <Palette
            size={tokens.iconSize}
            color={theme.icon}
            strokeWidth={tokens.iconStrokeWidth}
          />
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            Accent Color
          </Text>
          {onAccentColorPress ? (
            <Pressable
              onPress={handleAccentColorPress}
              accessibilityRole="button"
              accessibilityLabel={`Accent color, currently ${accentColorLabel}`}
              testID={`${testID}-accent-color-selector`}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 8 }}
              style={({ pressed }) => [
                styles.valueSelector,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.accentRight}>
                <View
                  style={[
                    styles.accentDot,
                    { backgroundColor: resolvedAccentDot },
                  ]}
                />
                <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
                  {accentColorLabel}
                </Text>
              </View>
              <Image
                source={CHEVRONS_ICON}
                style={styles.chevron}
                tintColor={theme.textMuted}
                contentFit="contain"
              />
            </Pressable>
          ) : (
            <View style={styles.valueSelector} testID={`${testID}-accent-color-selector`}>
              <View style={styles.accentRight}>
                <View
                  style={[
                    styles.accentDot,
                    { backgroundColor: resolvedAccentDot },
                  ]}
                />
                <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
                  {accentColorLabel}
                </Text>
              </View>
              <Image
                source={CHEVRONS_ICON}
                style={styles.chevron}
                tintColor={theme.textMuted}
                contentFit="contain"
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column',
    gap: tokens.gap,
  },
  headerFrame: {
    paddingLeft: tokens.headerPaddingLeft,
  },
  headerText: {
    fontSize: tokens.headerFontSize,
    fontWeight: '400',
    lineHeight: tokens.headerLineHeight,
  },
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
  valueSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.rowGap,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
  },
  value: {
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
  },
  chevron: {
    width: tokens.chevronSize,
    height: tokens.chevronSize,
  },
  accentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.accentRightGap,
  },
  accentDot: {
    width: tokens.accentDotSize,
    height: tokens.accentDotSize,
    borderRadius: tokens.accentDotRadius,
  },
  divider: {
    height: 1,
    marginLeft: tokens.dividerInsetLeft,
  },
});
