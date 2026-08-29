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
export type UpgradeProFeatureItem = {
  id?: string;
  label: string;
};

export type UpgradeProFeaturesSectionProps = {
  /** Section header title. Defaults to "Everything in Free, and:". */
  title?: string;
  /** List of feature items (strings or object with label) to display. */
  features?: (string | UpgradeProFeatureItem)[];
  /** Custom checkmark icon node to render instead of default blue checkmark icon. */
  icon?: React.ReactNode;
  /** Container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Optional test identifier. Defaults to "upgrade-pro-features-section". */
  testID?: string;
};

/** Default feature list for Joy Plus (selected by default on upgrade sheet). */
export const DEFAULT_UPGRADE_PLUS_FEATURES: string[] = [
  'Plugin integrations (WhatsApp, Spotify)',
  'Scheduled actions & automated tasks',
  'Personalization & custom instructions',
  'Expanded long-term memory summary',
  'Priority AI response speed',
  'Early access to new features & plugins',
];

/** Default feature list for Joy Pro. */
export const DEFAULT_UPGRADE_PRO_FEATURES: string[] = [
  'Unlimited active plugin integrations',
  'Unlimited scheduled actions & automations',
  'Frontier AI model with maximum reasoning',
  'Unlimited long-term memory & context',
  'Multi-device & physical robot pairing',
  'Highest priority speed & 24/7 execution',
];

/** @deprecated Use DEFAULT_UPGRADE_PLUS_FEATURES — kept for existing callers. */
export const DEFAULT_UPGRADE_FEATURES = DEFAULT_UPGRADE_PLUS_FEATURES;

const CHECK_ICON = require('@/assets/images/settings/icon-check.svg');

export function UpgradeProFeaturesSection({
  title = 'Everything in Free, and:',
  features = DEFAULT_UPGRADE_PLUS_FEATURES,
  icon,
  style,
  testID = 'upgrade-pro-features-section',
}: UpgradeProFeaturesSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {title ? (
        <Text style={[styles.headerText, { color: theme.textTitle }]} testID={`${testID}-header`}>
          {title}
        </Text>
      ) : null}
      <View style={styles.featuresList} testID={`${testID}-list`}>
        {features.map((item, index) => {
          const label = typeof item === 'string' ? item : item.label;
          const key = typeof item === 'string' ? item : item.id ?? label;

          return (
            <View
              key={key || index}
              style={styles.featureRow}
              testID={`${testID}-row-${index}`}
            >
              <View style={styles.iconWrapper} testID={`${testID}-row-${index}-icon`}>
                {icon ?? (
                  <Image
                    source={CHECK_ICON}
                    style={styles.icon}
                    tintColor={theme.accentPrimary ?? theme.linkPrimary}
                    contentFit="contain"
                    accessibilityLabel="Feature checkmark"
                  />
                )}
              </View>
              <Text style={[styles.featureText, { color: theme.text }]} testID={`${testID}-row-${index}-text`}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const tokens = SettingsTokens.upgradeProFeaturesSection;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: tokens.width,
    minHeight: tokens.minHeight,
    paddingTop: tokens.paddingTop,
    gap: tokens.gap,
  },
  headerText: {
    fontSize: tokens.typography.header.fontSize,
    fontWeight: tokens.typography.header.fontWeight,
    lineHeight: tokens.typography.header.lineHeight,
    color: tokens.colors.headerText,
  },
  featuresList: {
    width: '100%',
    gap: tokens.listGap,
  },
  featureRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.rowGap,
  },
  iconWrapper: {
    width: tokens.iconSize,
    height: tokens.iconSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: tokens.iconSize,
    height: tokens.iconSize,
  },
  featureText: {
    flex: 1,
    fontSize: tokens.typography.feature.fontSize,
    fontWeight: tokens.typography.feature.fontWeight,
    lineHeight: tokens.typography.feature.lineHeight,
    color: tokens.colors.featureText,
  },
});
