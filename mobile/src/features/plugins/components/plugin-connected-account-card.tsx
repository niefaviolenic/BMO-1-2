import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PluginsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PluginConnectedAccountCardProps = {
  /** Title of the connected app or service. Defaults to "WhatsApp". */
  title?: string;
  /** Subtitle detailing the account connection status. Defaults to "Connected to +62 812-3456-7890". */
  subtitle?: string;
  /** Remote URL for the service logo. */
  logoUrl?: string;
  /** Custom React node for the service logo. */
  logoComponent?: React.ReactNode;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PluginConnectedAccountCard({
  title = 'WhatsApp',
  subtitle = 'Connected to +62 812-3456-7890',
  logoUrl,
  logoComponent,
  style,
  testID = 'plugin-connected-account-card',
}: PluginConnectedAccountCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground },
        style,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.logoBox,
          { backgroundColor: theme.backgroundElement },
        ]}
        testID={`${testID}-logo-box`}
      >
        {logoComponent ? (
          logoComponent
        ) : logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.logoImage}
            contentFit="contain"
            accessibilityLabel={`${title} logo`}
            testID={`${testID}-logo-image`}
          />
        ) : (
          <Image
            source={require('@/assets/images/plugins/whatsapp-logo.png')}
            style={styles.logoImage}
            contentFit="contain"
            accessibilityLabel={`${title} logo`}
            testID={`${testID}-logo-image`}
          />
        )}
      </View>

      <View style={styles.textColumn} testID={`${testID}-text-column`}>
        <Text
          style={[styles.titleText, { color: theme.text }]}
          numberOfLines={1}
          testID={`${testID}-title`}
        >
          {title}
        </Text>
        <Text
          style={[styles.subtitleText, { color: theme.textSecondary }]}
          numberOfLines={1}
          testID={`${testID}-subtitle`}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 370,
    maxWidth: '100%',
    height: 126,
    borderRadius: PluginsTokens.borderRadius.card,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 8,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  textColumn: {
    flexDirection: 'column',
    gap: 2,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
});
