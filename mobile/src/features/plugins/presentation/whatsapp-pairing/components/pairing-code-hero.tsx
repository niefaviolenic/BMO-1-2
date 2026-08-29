import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PairingCodeHeroTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
const DEFAULT_TITLE = 'Your WhatsApp Pairing Code';
const DEFAULT_SUBTITLE =
  'Enter this 8-digit code in your WhatsApp mobile app to complete the Joy integration.';

export type PairingCodeHeroProps = {
  /** Main heading. Defaults to "Your WhatsApp Pairing Code". */
  title?: string;
  /** Descriptive subtitle shown below the title. */
  subtitle?: string;
  /** Custom style overrides for the container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

/**
 * PairingCodeHero
 *
 * Renders the hero header for the WhatsApp 8-digit pairing code screen.
 * Composed of a bold title and a secondary subtitle.
 *
 * Width 354 · title 16px/600 · subtitle 13px/400
 */
export function PairingCodeHero({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  style,
  testID = 'pairing-code-hero',
}: PairingCodeHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} testID={testID + '-title'}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID={testID + '-subtitle'}>
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
    color: Tokens.title.color,
  },
  subtitle: {
    fontSize: Tokens.subtitle.fontSize,
    fontWeight: Tokens.subtitle.fontWeight,
    color: Tokens.subtitle.color,
    minHeight: Tokens.subtitle.minHeight,
  },
});
