import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { PairingSuccessHeroTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type PairingSuccessHeroProps = {
  /** WhatsApp phone number shown in the description. Defaults to "+62 812-3456-7890". */
  phoneNumber?: string;
  /** Status pill label text. Defaults to "STATUS: ACTIVE & CONNECTED". */
  statusText?: string;
  /** Custom style overrides for the outer container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

/**
 * PairingSuccessHero
 *
 * Vertical success hero for the WhatsApp connected step (Figma 611:134817).
 * Shows a 56×56 WhatsApp icon box, title, description with linked phone number,
 * and a slate status pill.
 *
 * Width 354 · gap 10
 */
export function PairingSuccessHero({
  phoneNumber = '+62 812-3456-7890',
  statusText = 'STATUS: ACTIVE & CONNECTED',
  style,
  testID = 'pairing-success-hero',
}: PairingSuccessHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }, style]} testID={testID}>
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-icon-box`}
      >
        <Image
          source={require('@/assets/images/plugins/whatsapp-logo.png')}
          style={styles.iconImage}
          contentFit="contain"
          accessibilityLabel="WhatsApp logo"
        />
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} testID={`${testID}-title`}>
        WhatsApp Connected!
      </Text>

      <Text style={[styles.description, { color: theme.textSecondary }]} testID={`${testID}-description`}>
        {`Account ${phoneNumber} is successfully linked to Joy engine. You are ready to go!`}
      </Text>

      <View
        style={[
          styles.badge,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-badge`}
      >
        <Text style={[styles.badgeText, { color: theme.textSecondary }]} testID={`${testID}-badge-text`}>
          {statusText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Tokens.layout.width,
    maxWidth: '100%',
    backgroundColor: Tokens.colors.background,
    gap: Tokens.layout.gap,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: Tokens.layout.iconBoxSize,
    height: Tokens.layout.iconBoxSize,
    borderRadius: Tokens.layout.iconBoxBorderRadius,
    backgroundColor: Tokens.colors.background,
    borderWidth: 1,
    borderColor: Tokens.colors.iconBoxBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: Tokens.layout.iconSize,
    height: Tokens.layout.iconSize,
  },
  title: {
    fontSize: Tokens.typography.title.fontSize,
    fontWeight: Tokens.typography.title.fontWeight,
    color: Tokens.colors.title,
  },
  description: {
    width: '100%',
    fontSize: Tokens.typography.description.fontSize,
    fontWeight: Tokens.typography.description.fontWeight,
    color: Tokens.colors.description,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Tokens.colors.badgeBackground,
    borderWidth: 1,
    borderColor: Tokens.colors.badgeBorder,
    borderRadius: Tokens.badge.borderRadius,
    paddingHorizontal: Tokens.badge.paddingHorizontal,
    paddingVertical: Tokens.badge.paddingVertical,
  },
  badgeText: {
    fontSize: Tokens.typography.badge.fontSize,
    fontWeight: Tokens.typography.badge.fontWeight,
    color: Tokens.colors.badgeText,
  },
});
