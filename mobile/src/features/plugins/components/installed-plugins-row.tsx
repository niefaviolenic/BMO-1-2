import { Image } from 'expo-image';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/hooks/use-theme';

export type InstalledPluginItem = {
  id: string;
  name: string;
  iconUrl?: string;
  iconComponent?: React.ReactNode;
};

export type InstalledPluginsRowProps = {
  items?: InstalledPluginItem[];
  onPluginPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

const DEFAULT_ITEMS: InstalledPluginItem[] = [];

export function InstalledPluginsRow({
  items = DEFAULT_ITEMS,
  onPluginPress,
  style,
  contentContainerStyle,
  testID = 'installed-plugins-row',
}: InstalledPluginsRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.wrapper, style]} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        testID={`${testID}-scroll`}
      >
        {items.map((item, index) => {
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.itemContainer, pressed && styles.pressed]}
              onPress={() => onPluginPress?.(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              testID={`${testID}-item-${item.id}-${index}`}
            >
              {item.iconComponent ? (
                item.iconComponent
              ) : item.iconUrl ? (
                <View style={[styles.iconBox, { borderColor: theme.border, borderWidth: 1 }]}>
                  <Image
                    source={{ uri: item.iconUrl }}
                    style={styles.iconImage}
                    contentFit="cover"
                    accessibilityLabel={item.name}
                  />
                </View>
              ) : (
                renderFallbackIcon(item, theme)
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function renderFallbackIcon(item: InstalledPluginItem, theme: ThemePalette) {
  const normalizedId = item.id.toLowerCase();
  const normalizedName = item.name.toLowerCase();

  let bgColor = theme.backgroundElement;
  let textColor = '#FFFFFF';
  let label = item.name ? item.name.substring(0, 2).toUpperCase() : 'P';

  if (normalizedId.includes('whatsapp') || normalizedName.includes('whatsapp')) {
    bgColor = '#25D366';
  } else if (normalizedId.includes('spotify') || normalizedName.includes('spotify')) {
    bgColor = '#1DB954';
  } else if (normalizedId.includes('google-docs') || normalizedId.includes('docs') || normalizedName.includes('docs')) {
    bgColor = '#4285F4';
  } else if (normalizedId.includes('figma') || normalizedName.includes('figma')) {
    bgColor = '#F24E1E';
  } else if (normalizedId.includes('github') || normalizedName.includes('github')) {
    bgColor = '#24292E';
  } else if (normalizedId.includes('analytics') || normalizedName.includes('analytics')) {
    bgColor = '#F4B400';
  } else if (normalizedId.includes('pdf') || normalizedName.includes('pdf')) {
    bgColor = '#EA4335';
  } else if (normalizedId.includes('drive') || normalizedName.includes('drive')) {
    bgColor = '#0F9D58';
  } else if (normalizedId.includes('sheets') || normalizedName.includes('sheets')) {
    bgColor = '#0F9D58';
  } else {
    textColor = theme.text;
  }

  return (
    <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
      <Text style={[styles.iconText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemContainer: {
    width: 44,
    height: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  iconText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
