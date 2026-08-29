import * as WebBrowser from 'expo-web-browser';
import { Lock, NotebookText } from 'lucide-react-native';
import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';
import {
  ABOUT_LEGAL_URLS,
  DEFAULT_ABOUT_INFO,
} from '@/features/settings/data/about/dummy-about';
import type { AboutInfo } from '@/features/settings/domain/about/types';

const tokens = SettingsTokens.aboutSheet;

export type AboutLinksCardProps = {
  aboutInfo?: AboutInfo;
  termsUrl?: string;
  privacyUrl?: string;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AboutLinksCard({
  aboutInfo = DEFAULT_ABOUT_INFO,
  termsUrl = ABOUT_LEGAL_URLS.termsUrl,
  privacyUrl = ABOUT_LEGAL_URLS.privacyUrl,
  onTermsPress,
  onPrivacyPress,
  style,
  testID = 'about-links-card',
}: AboutLinksCardProps) {
  const theme = useTheme();
  const handleTermsPress = useCallback(() => {
    if (onTermsPress) {
      onTermsPress();
      return;
    }
    void WebBrowser.openBrowserAsync(termsUrl).catch(() => undefined);
  }, [onTermsPress, termsUrl]);

  const handlePrivacyPress = useCallback(() => {
    if (onPrivacyPress) {
      onPrivacyPress();
      return;
    }
    void WebBrowser.openBrowserAsync(privacyUrl).catch(() => undefined);
  }, [onPrivacyPress, privacyUrl]);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.cardBackground }, style]}
      testID={testID}
    >
      <Pressable
        onPress={handleTermsPress}
        accessibilityRole="link"
        accessibilityLabel="Terms of use"
        testID={`${testID}-terms`}
        style={({ pressed }) => [
          styles.linkRow,
          pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
        ]}
      >
        <NotebookText
          size={tokens.iconSize}
          color={theme.icon}
          strokeWidth={tokens.iconStrokeWidth}
        />
        <Text
          style={[styles.linkLabel, { color: theme.text }]}
          numberOfLines={1}
        >
          Terms of use
        </Text>
      </Pressable>

      <View style={styles.dividerWrapper}>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
      </View>

      <Pressable
        onPress={handlePrivacyPress}
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        testID={`${testID}-privacy`}
        style={({ pressed }) => [
          styles.linkRow,
          pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
        ]}
      >
        <Lock
          size={tokens.iconSize}
          color={theme.icon}
          strokeWidth={tokens.iconStrokeWidth}
        />
        <Text
          style={[styles.linkLabel, { color: theme.text }]}
          numberOfLines={1}
        >
          Privacy policy
        </Text>
      </Pressable>

      <View style={styles.dividerWrapper}>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
      </View>

      <View style={styles.versionRow} testID={`${testID}-version`}>
        <Text
          style={[styles.versionTitle, { color: theme.text }]}
          numberOfLines={1}
        >
          {aboutInfo.platformLabel}
        </Text>
        <Text
          style={[styles.versionSubtitle, { color: theme.textMuted }]}
          numberOfLines={1}
        >
          {aboutInfo.versionLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.cardRadius,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.rowGap,
    paddingHorizontal: tokens.rowPaddingHorizontal,
    paddingVertical: tokens.rowPaddingVertical,
  },
  rowPressed: {
    backgroundColor: '#F5F5F7',
  },
  linkLabel: {
    flex: 1,
    fontSize: tokens.labelFontSize,
    color: tokens.labelColor,
  },
  dividerWrapper: {
    width: '100%',
    paddingHorizontal: tokens.dividerInsetHorizontal,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.dividerColor,
  },
  versionRow: {
    paddingHorizontal: tokens.rowPaddingHorizontal,
    paddingVertical: tokens.versionRowPaddingVertical,
    gap: tokens.versionTitleSubtitleGap,
  },
  versionTitle: {
    fontSize: tokens.versionTitleFontSize,
    color: tokens.versionTitleColor,
  },
  versionSubtitle: {
    fontSize: tokens.versionSubtitleFontSize,
    color: tokens.versionSubtitleColor,
  },
});
