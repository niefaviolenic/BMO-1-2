import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
export type PluginBrandLogoProps = {
  pluginId: string;
  size?: number;
  testID?: string;
};

export function PluginBrandLogo({
  pluginId,
  size = 24,
  testID,
}: PluginBrandLogoProps) {
  const theme = useTheme();

  if (pluginId === 'whatsapp') {
    return (
      <Image
        source={require('@/assets/images/plugins/whatsapp-logo.png')}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel="WhatsApp"
        testID={testID}
      />
    );
  }

  if (pluginId === 'spotify') {
    return (
      <Image
        source={require('@/assets/images/plugins/spotify-logo.png')}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel="Spotify"
        testID={testID}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 4),
          backgroundColor: theme.divider,
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.fallbackText, { fontSize: Math.max(10, size / 3), color: theme.text }]}>
        {pluginId.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: '700',
    color: PluginsTokens.colors.textPrimary,
  },
});
