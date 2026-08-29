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
export type PluginAppSectionProps = {
  /** Name of the app to display. Defaults to "WhatsApp". */
  appName?: string;
  /** Custom React node for the app icon (24x24). */
  appIcon?: React.ReactNode;
  /** Remote URL for the app icon. */
  appIconUrl?: string;
  /** Custom style overrides for the container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PluginAppSection({
  appName = 'WhatsApp',
  appIcon,
  appIconUrl,
  style,
  testID = 'plugin-app-section',
}: PluginAppSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.headerText, { color: theme.textTitle }]} testID={`${testID}-header`}>
        App
      </Text>
      <View style={styles.appRow} testID={`${testID}-row`}>
        <View style={styles.iconBox} testID={`${testID}-icon-box`}>
          {appIcon ? (
            appIcon
          ) : appIconUrl ? (
            <Image
              source={{ uri: appIconUrl }}
              style={styles.iconImage}
              contentFit="contain"
              accessibilityLabel={`${appName} icon`}
              testID={`${testID}-icon-image`}
            />
          ) : (
            <Image
              source={require('@/assets/images/plugins/whatsapp-logo.png')}
              style={styles.iconImage}
              contentFit="contain"
              accessibilityLabel={`${appName} icon`}
              testID={`${testID}-icon-image`}
            />
          )}
        </View>
        <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1} testID={`${testID}-name`}>
          {appName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: PluginsTokens.appSection.width,
    height: PluginsTokens.appSection.height,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: PluginsTokens.appSection.gap,
  },
  headerText: {
    fontSize: PluginsTokens.appSection.headerFontSize,
    fontWeight: '600',
    lineHeight: PluginsTokens.appSection.headerLineHeight,
    color: PluginsTokens.colors.textPrimary,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PluginsTokens.appSection.gap,
  },
  iconBox: {
    width: PluginsTokens.appSection.iconSize,
    height: PluginsTokens.appSection.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: PluginsTokens.appSection.iconSize,
    height: PluginsTokens.appSection.iconSize,
  },
  nameText: {
    fontSize: PluginsTokens.appSection.nameFontSize,
    fontWeight: '600',
    lineHeight: PluginsTokens.appSection.nameLineHeight,
    color: PluginsTokens.colors.textPrimary,
  },
});
