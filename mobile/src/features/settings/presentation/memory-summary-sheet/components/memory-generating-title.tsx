import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { MemorySummarySheetTokens } from '@/constants/theme';
const tokens = MemorySummarySheetTokens.titleColumn;

export type MemoryGeneratingTitleProps = {
  /** Title text. Defaults to 'Memory summary'. */
  title?: string;
  /** Subtitle text. Defaults to 'Generating'. */
  subtitle?: string;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
  /** Test identifier. Defaults to 'memory-generating-title'. */
  testID?: string;
};

export function MemoryGeneratingTitle({
  title = 'Memory summary',
  subtitle = 'Generating',
  style,
  testID = 'memory-generating-title',
}: MemoryGeneratingTitleProps) {
  const theme = useTheme();
  const isUpdated = subtitle !== 'Generating';

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.titleText, { color: theme.textTitle }]} numberOfLines={1}>
        {title}
      </Text>
      <Text
        style={[styles.subtitleText, { color: theme.textSecondary }]}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.gap,
  },
  titleText: {
    fontSize: tokens.titleFont.fontSize,
    fontWeight: tokens.titleFont.fontWeight,
    lineHeight: tokens.titleFont.lineHeight,
    color: tokens.titleFont.color,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: tokens.subtitleFont.fontSize,
    fontWeight: tokens.subtitleFont.fontWeight,
    lineHeight: tokens.subtitleFont.lineHeight,
    color: tokens.subtitleFont.color,
    textAlign: 'center',
  },
  updatedSubtitle: {
    color: tokens.updatedSubtitleColor,
  },
});
