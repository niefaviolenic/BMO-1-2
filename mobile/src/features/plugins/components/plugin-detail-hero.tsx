import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
export type PluginDetailHeroProps = {
  title: string;
  subtitle: string;
  logo?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PluginDetailHero({
  title,
  subtitle,
  logo,
  style,
  testID = 'plugin-detail-hero',
}: PluginDetailHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
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
        {logo ? (
          logo
        ) : (
          <Image
            source={require('@/assets/images/plugins/whatsapp-logo.png')}
            style={styles.logoImage}
            contentFit="contain"
            accessibilityLabel={`${title} logo`}
          />
        )}
      </View>

      <View style={styles.titleStack}>
        <Text style={[styles.title, { color: theme.textTitle }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 354,
    maxWidth: '100%',
    height: 115,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: PluginsTokens.colors.cardBackground,
    borderWidth: 1,
    borderColor: PluginsTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  titleStack: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: PluginsTokens.colors.textPrimary,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: PluginsTokens.colors.textSecondary,
    lineHeight: 18,
  },
});
