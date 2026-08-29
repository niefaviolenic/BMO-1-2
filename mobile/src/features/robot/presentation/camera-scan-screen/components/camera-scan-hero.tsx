import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CameraScanHeroTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CameraScanHeroProps = {
  /** Primary heading label. Defaults to "Scan QR Code on Joy Robot". */
  title?: string;
  /** Supporting subtitle text shown below title. */
  subtitle?: string;
  /** Custom style overrides for the container. */
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_TITLE = 'Scan QR Code on Joy Robot';
const DEFAULT_SUBTITLE =
  'Point your phone camera at the QR code displayed on the Joy Robot face screen.';

/**
 * CameraScanHero
 *
 * Renders the hero header text column for the Pair Joy Robot / Camera Scan screen.
 * Composed of a bold title and secondary subtitle text.
 *
 * Width 354 · title 16px/600 · subtitle 13px/400
 */
export function CameraScanHero({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  style,
}: CameraScanHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID="camera-scan-hero">
      <Text
        style={[styles.title, { color: theme.text }]}
        numberOfLines={1}
        testID="camera-scan-hero-title"
      >
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID="camera-scan-hero-subtitle">
        {subtitle}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: Tokens.layout.width,
    gap: Tokens.layout.gap,
  },
  title: {
    fontSize: Tokens.title.fontSize,
    fontWeight: Tokens.title.fontWeight,
    lineHeight: Tokens.title.lineHeight,
    color: Tokens.colors.title,
  },
  subtitle: {
    fontSize: Tokens.subtitle.fontSize,
    fontWeight: Tokens.subtitle.fontWeight,
    lineHeight: Tokens.subtitle.lineHeight,
    color: Tokens.colors.subtitle,
  },
});
