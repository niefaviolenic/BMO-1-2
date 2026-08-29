import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
import type { SpotifyDevice } from '@/features/plugins/domain/spotify';

export type SpotifyDeviceListProps = {
  devices: SpotifyDevice[];
  activeDeviceId: string | null;
  disabled?: boolean;
  onSelect?: (deviceId: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const tokens = PluginsTokens.spotifyPlayer;

export function SpotifyDeviceList({
  devices,
  activeDeviceId,
  disabled = false,
  onSelect,
  style,
  testID = 'spotify-device-list',
}: SpotifyDeviceListProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, style]} testID={testID}>
      <Text style={[styles.header, { color: theme.textMuted }]}>Playback device</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
      >
        {devices.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]} testID={`${testID}-empty`}>
            Open Spotify on a phone or speaker, then refresh.
          </Text>
        ) : (
          devices.map((device, index) => {
            const selected = device.id === activeDeviceId || device.isActive;
            return (
              <Pressable
                key={device.id}
                onPress={() => onSelect?.(device.id)}
                disabled={disabled || device.isRestricted}
                accessibilityRole="button"
                accessibilityLabel={device.name}
                testID={`${testID}-item-${device.id}`}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && [styles.rowDivider, { borderTopColor: theme.divider }],
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                    {device.name}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {device.type ?? 'Device'}
                    {device.isRestricted ? ' · restricted' : ''}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.dot} testID={`${testID}-selected-${device.id}`} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    maxWidth: 354,
    gap: 8,
  },
  header: {
    fontSize: tokens.headerFontSize,
    lineHeight: tokens.headerLineHeight,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    borderRadius: tokens.cardRadius,
    overflow: 'hidden',
  },
  empty: {
    padding: tokens.cardPadding,
    fontSize: tokens.subtitleFontSize,
    lineHeight: tokens.subtitleLineHeight,
  },
  row: {
    minHeight: tokens.rowHeight,
    paddingHorizontal: tokens.cardPadding,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: tokens.titleFontSize,
    lineHeight: tokens.titleLineHeight,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: tokens.subtitleFontSize,
    lineHeight: tokens.subtitleLineHeight,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PluginsTokens.colors.iconSpotify,
  },
  pressed: {
    opacity: 0.7,
  },
});
