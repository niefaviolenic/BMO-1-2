import React from 'react';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';

export type PluginLegalDisclaimerProps = {
  /** Optional custom text override for the disclaimer. */
  text?: string;
  /** Name of the connected app. Defaults to 'WhatsApp'. */
  appName?: string;
  /** Callback fired when 'terms' link is pressed. */
  onTermsPress?: () => void;
  /** Callback fired when 'privacy policy' link is pressed. */
  onPrivacyPolicyPress?: () => void;
  /** Callback fired when 'Memory' link is pressed. */
  onMemoryPress?: () => void;
  /** Callback fired when 'elevated risk' link is pressed. */
  onElevatedRiskPress?: () => void;
  /** Callback fired when 'Learn more' link is pressed. */
  onLearnMorePress?: () => void;
  /** Custom text style overrides. */
  style?: StyleProp<TextStyle>;
  /** Test identifier for automated testing. */
  testID?: string;
};

export function PluginLegalDisclaimer({
  text,
  appName = 'WhatsApp',
  onTermsPress,
  onPrivacyPolicyPress,
  onMemoryPress,
  onElevatedRiskPress,
  onLearnMorePress,
  style,
  testID = 'plugin-legal-disclaimer',
}: PluginLegalDisclaimerProps) {
  const theme = useTheme();

  if (text) {
    return (
      <Text style={[styles.disclaimerText, { color: theme.textMuted }, style]} testID={testID}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={[styles.disclaimerText, { color: theme.textMuted }, style]} testID={testID}>
      When connected to {appName}, Joy may share relevant chats and memories with this app to help provide context for your requests. {appName}&apos;s use of this data is subject to their{' '}
      <Text
        style={[styles.linkText, { color: theme.text }]}
        onPress={onTermsPress}
        testID={`${testID}-terms-link`}
      >
        terms
      </Text>
      {' and '}
      <Text
        style={[styles.linkText, { color: theme.text }]}
        onPress={onPrivacyPolicyPress}
        testID={`${testID}-privacy-link`}
      >
        privacy policy
      </Text>
      . If you have{' '}
      <Text
        style={[styles.linkText, { color: theme.text }]}
        onPress={onMemoryPress}
        testID={`${testID}-memory-link`}
      >
        Memory
      </Text>{' '}
      enabled, data from the app may be used to proactively provide helpful information or suggestions. Joy always respects your training data preferences, including for data from connected apps. Use of apps may come with{' '}
      <Text
        style={[styles.linkText, { color: theme.text }]}
        onPress={onElevatedRiskPress}
        testID={`${testID}-risk-link`}
      >
        elevated risk
      </Text>
      . You can manage your preferences or disconnect from apps anytime in your settings.{' '}
      <Text
        style={[styles.linkText, { color: theme.text }]}
        onPress={onLearnMorePress}
        testID={`${testID}-learn-more-link`}
      >
        Learn more
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  disclaimerText: {
    width: '100%',
    maxWidth: PluginsTokens.legalDisclaimer.width,
    fontSize: PluginsTokens.legalDisclaimer.fontSize,
    lineHeight: PluginsTokens.legalDisclaimer.lineHeight,
    color: PluginsTokens.colors.textMuted,
    fontWeight: '400',
  },
  linkText: {
    fontSize: PluginsTokens.legalDisclaimer.fontSize,
    lineHeight: PluginsTokens.legalDisclaimer.lineHeight,
    color: PluginsTokens.colors.textPrimary,
    textDecorationLine: 'underline',
    fontWeight: '400',
  },
});
