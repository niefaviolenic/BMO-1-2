import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PairingPhoneHeroTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DEFAULT_TITLE = 'Link your WhatsApp to Joy';
const DEFAULT_SUBTITLE =
  'Enter your WhatsApp phone number to generate an 8-digit pairing code. Joy uses this to securely integrate with your chats.';

export type PairingPhoneHeroProps = {
  /** Main heading. Defaults to "Link your WhatsApp to Joy". */
  title?: string;
  /** Descriptive subtitle shown below the title. */
  subtitle?: string;
  /** Optional custom logo node. Defaults to WhatsApp logo. */
  logo?: React.ReactNode;
  /** Custom style overrides for the container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PairingPhoneHero({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  logo,
  style,
  testID = 'pairing-phone-hero',
}: PairingPhoneHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View
        style={[
          styles.logoBox,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-logo-box`}
      >
        {logo ?? (
          <Image
            source={require('@/assets/images/plugins/whatsapp-logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="WhatsApp logo"
          />
        )}
      </View>

      <Text style={[styles.title, { color: theme.text }]} testID={`${testID}-title`}>
        {title}
      </Text>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID={`${testID}-subtitle`}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Tokens.layout.width,
    maxWidth: '100%',
    gap: Tokens.layout.gap,
    alignItems: 'flex-start',
  },
  logoBox: {
    width: Tokens.logoBox.size,
    height: Tokens.logoBox.size,
    borderRadius: Tokens.logoBox.borderRadius,
    borderWidth: Tokens.logoBox.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: Tokens.logoBox.logoSize,
    height: Tokens.logoBox.logoSize,
  },
  title: {
    fontSize: Tokens.title.fontSize,
    fontWeight: Tokens.title.fontWeight,
  },
  subtitle: {
    fontSize: Tokens.subtitle.fontSize,
    fontWeight: Tokens.subtitle.fontWeight,
    lineHeight: 18,
  },
});
