import { ChevronRight, Flag, Info } from 'lucide-react-native';
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

const tokens = SettingsTokens.helpSection;

export type SettingsHelpSectionProps = {
  title?: string;
  onReportPress?: () => void;
  onAboutPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SettingsHelpSection({
  title = 'Get help',
  onReportPress,
  onAboutPress,
  style,
  testID = 'settings-help-section',
}: SettingsHelpSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
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
        {/* Row 1: Report an App Issue */}
        <Pressable
          onPress={onReportPress}
          disabled={!onReportPress}
          accessibilityRole={onReportPress ? 'button' : undefined}
          accessibilityLabel="Report an App Issue"
          testID={`${testID}-row-report`}
          style={({ pressed }) => [
            styles.row,
            onReportPress && pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
          ]}
        >
          <Flag
            size={tokens.iconSize}
            color={theme.icon}
            strokeWidth={tokens.iconStrokeWidth}
          />
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            Report an App Issue
          </Text>
          <ChevronRight
            size={tokens.chevronSize}
            color={theme.textMuted}
            strokeWidth={tokens.iconStrokeWidth}
          />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Row 2: About Joy */}
        <Pressable
          onPress={onAboutPress}
          disabled={!onAboutPress}
          accessibilityRole={onAboutPress ? 'button' : undefined}
          accessibilityLabel="About Joy"
          testID={`${testID}-row-about`}
          style={({ pressed }) => [
            styles.row,
            onAboutPress && pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
          ]}
        >
          <Info
            size={tokens.iconSize}
            color={theme.icon}
            strokeWidth={tokens.iconStrokeWidth}
          />
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            About Joy
          </Text>
          <ChevronRight
            size={tokens.chevronSize}
            color={theme.textMuted}
            strokeWidth={tokens.iconStrokeWidth}
          />
        </Pressable>
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
  rowPressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
  },
  divider: {
    height: 1,
    marginLeft: tokens.dividerInsetLeft,
  },
});
