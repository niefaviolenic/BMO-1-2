import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { QRPairingHeroTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type QRPairingHeroProps = {
  /** Primary heading. Defaults to the standard "Scan QR Code to Pair" label. */
  title?: string;
  /** Supporting description shown below the title. */
  subtitle?: string;
  /** Custom style overrides for the root container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};
const DEFAULT_TITLE = 'Link WhatsApp to Joy';
const DEFAULT_SUBTITLE =
  'Tap Link Device in WhatsApp. That uses the same pairing payload as scanning the QR.';

export function QRPairingHero({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  style,
  testID = 'qr-pairing-hero',
}: QRPairingHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text
        style={[styles.title, { color: theme.text }]}
        numberOfLines={1}
        testID={testID + '-title'}
      >
        {title}
      </Text>
      <Text
        style={[styles.subtitle, { color: theme.textSecondary }]}
        testID={testID + '-subtitle'}
      >
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
