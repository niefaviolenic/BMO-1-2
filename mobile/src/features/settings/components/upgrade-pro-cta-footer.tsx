import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

export type UpgradeProCtaFooterProps = {
  /** Text shown inside the primary CTA button. Defaults to "Upgrade". */
  buttonText?: string;
  /** Primary caption text below the CTA button. Defaults to "Auto-renews monthly. Cancel anytime.". */
  autoRenewText?: string;
  /** Secondary disclaimer caption text. Defaults to "Unlimited subject to abuse guardrails.". */
  disclaimerText?: string;
  /** Callback when the Upgrade CTA button is pressed. */
  onPress?: () => void;
  /** Alternative alias for onPress callback when Upgrade button is pressed. */
  onUpgradePress?: () => void;
  /** Whether the CTA button is disabled. Defaults to false. */
  disabled?: boolean;
  /** Whether the CTA button is in a loading state. Defaults to false. */
  loading?: boolean;
  /** Container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Test identifier for component testing. Defaults to "upgrade-pro-cta-footer". */
  testID?: string;
};

export function UpgradeProCtaFooter({
  buttonText = 'Upgrade',
  autoRenewText = 'Auto-renews monthly. Cancel anytime.',
  disclaimerText = 'Unlimited subject to abuse guardrails.',
  onPress,
  onUpgradePress,
  disabled = false,
  loading = false,
  style,
  testID = 'upgrade-pro-cta-footer',
}: UpgradeProCtaFooterProps) {
  const theme = useTheme();
  const handlePress = onPress ?? onUpgradePress;
  return (
    <View style={[styles.container, style]} testID={testID}>
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={buttonText}
        accessibilityState={{ disabled: disabled || loading }}
        testID={`${testID}-button`}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.text },
          disabled && styles.buttonDisabled,
          pressed && !(disabled || loading) && styles.buttonPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={theme.background}
            testID={`${testID}-button-spinner`}
          />
        ) : (
          <Text style={[styles.buttonText, { color: theme.background }]} testID={`${testID}-button-text`}>
            {buttonText}
          </Text>
        )}
      </Pressable>

      <View style={styles.captionsContainer} testID={`${testID}-captions`}>
        <Text style={[styles.autoRenewText, { color: theme.textSecondary }]} testID={`${testID}-auto-renew`}>
          {autoRenewText}
        </Text>
        <Text style={[styles.disclaimerText, { color: theme.textMuted }]} testID={`${testID}-disclaimer`}>
          {disclaimerText}
        </Text>
      </View>
    </View>
  );
}

const tokens = SettingsTokens.upgradeProCtaFooter;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: tokens.width,
    minHeight: tokens.height,
    paddingTop: tokens.paddingTop,
    paddingBottom: tokens.paddingBottom,
    paddingHorizontal: tokens.paddingHorizontal,
    gap: tokens.gap,
    alignItems: 'center',
    justifyContent: 'center',

  },
  button: {
    width: '100%',
    height: tokens.button.height,
    borderRadius: tokens.button.borderRadius,
    backgroundColor: tokens.button.backgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: tokens.button.fontSize,
    fontWeight: tokens.button.fontWeight,
    color: tokens.button.textColor,
    textAlign: 'center',
  },
  captionsContainer: {
    width: '100%',
    gap: tokens.footerCaptions.gap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoRenewText: {
    fontSize: tokens.footerCaptions.fontSize,
    fontWeight: tokens.footerCaptions.fontWeight,
    color: tokens.footerCaptions.autoRenewColor,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: tokens.footerCaptions.fontSize,
    fontWeight: tokens.footerCaptions.fontWeight,
    color: tokens.footerCaptions.disclaimerColor,
    textAlign: 'center',
  },
});
