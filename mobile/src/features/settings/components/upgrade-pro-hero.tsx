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
import { SettingsTokens } from '@/constants/theme';
export type UpgradeProHeroProps = {
  /** Main title displayed in hero block. Defaults to "Get Joy Plus". */
  title?: string;
  /** Subtitle description text. Defaults to "Get more of Joy with expanded access". */
  subtitle?: string;
  /** Optional custom hero icon node. Defaults to Lucide Gem SVG icon. */
  icon?: React.ReactNode;
  /** Container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Optional test identifier. Defaults to "upgrade-pro-hero". */
  testID?: string;
};

const GEM_ICON = require('@/assets/images/settings/icon-gem.svg');

export function UpgradeProHero({
  title = 'Get Joy Plus',
  subtitle = 'Get more of Joy with expanded access',
  icon,
  style,
  testID = 'upgrade-pro-hero',
}: UpgradeProHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.iconWrapper} testID={`${testID}-icon-wrapper`}>
        {icon ?? (
          <Image
            source={GEM_ICON}
            style={styles.icon}
            tintColor={theme.accentPrimary ?? theme.linkPrimary}
            contentFit="contain"
            accessibilityLabel="Joy Hero Gem Icon"
            testID={`${testID}-gem-icon`}
          />
        )}
      </View>
      <Text style={[styles.title, { color: theme.textTitle }]} testID={`${testID}-title`}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID={`${testID}-subtitle`}>
        {subtitle}
      </Text>
    </View>
  );
}

const tokens = SettingsTokens.upgradeProHero;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: tokens.width,
    minHeight: tokens.height,
    paddingTop: tokens.paddingTop,
    paddingRight: tokens.paddingRight,
    paddingBottom: tokens.paddingBottom,
    paddingLeft: tokens.paddingLeft,
    gap: tokens.gap,
    alignItems: tokens.alignItems,
  },
  iconWrapper: {
    width: tokens.iconWrapperSize,
    height: tokens.iconWrapperSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: tokens.iconSize,
    height: tokens.iconSize,
  },
  title: {
    fontSize: tokens.titleFontSize,
    fontWeight: tokens.titleFontWeight,
    lineHeight: tokens.titleLineHeight,
    color: tokens.titleColor,
    textAlign: tokens.textAlign,
    width: '100%',
  },
  subtitle: {
    fontSize: tokens.subtitleFontSize,
    fontWeight: tokens.subtitleFontWeight,
    lineHeight: tokens.subtitleLineHeight,
    color: tokens.subtitleColor,
    textAlign: tokens.textAlign,
    width: '100%',
  },
});
