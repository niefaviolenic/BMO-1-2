import { Headphones, Music, Play, Radio, SkipBack, SkipForward, Sparkles, Volume2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PluginBrandLogo } from '@/features/plugins/components/plugin-brand-logo';
import { PluginsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SpotifyPreviewCardPlayer({ testID = 'spotify-preview-card-player' }: { testID?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.cardContent, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <PluginBrandLogo pluginId="spotify" size={18} />
          <Text style={[styles.cardHeaderTitle, { color: theme.textTitle }]}>Now Playing</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: 'rgba(29, 185, 84, 0.15)' }]}>
          <View style={[styles.statusDot, { backgroundColor: PluginsTokens.colors.iconSpotify }]} />
          <Text style={[styles.statusBadgeText, { color: PluginsTokens.colors.iconSpotify }]}>Playing</Text>
        </View>
      </View>

      {/* Album Art & Track Info */}
      <View style={[styles.trackCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.albumArtContainer}>
          <View
            style={[
              styles.albumArt,
              {
                backgroundColor: 'rgba(29, 185, 84, 0.12)',
                borderColor: 'rgba(29, 185, 84, 0.25)',
                borderWidth: 1,
              },
            ]}
          >
            <View style={[styles.vinylGroove, { borderColor: 'rgba(29, 185, 84, 0.2)' }]} />
            <Music size={22} color={PluginsTokens.colors.iconSpotify} />
          </View>
          <View style={styles.trackDetails}>
            <Text style={[styles.trackTitle, { color: theme.textTitle }]} numberOfLines={1}>
              Neon City Nights
            </Text>
            <Text style={[styles.trackArtist, { color: theme.textSecondary }]} numberOfLines={1}>
              Joy Lo-Fi & Chill
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { backgroundColor: PluginsTokens.colors.iconSpotify, width: '58%' }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: theme.textMuted }]}>1:48</Text>
            <Text style={[styles.timeText, { color: theme.textMuted }]}>3:12</Text>
          </View>
        </View>

        {/* Player Controls */}
        <View style={styles.controlsRow}>
          <SkipBack size={16} color={theme.textTitle} />
          <View style={[styles.playButtonCircle, { backgroundColor: PluginsTokens.colors.iconSpotify }]}>
            <Play size={14} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
          <SkipForward size={16} color={theme.textTitle} />
        </View>
      </View>

      {/* Bottom Device Indicator */}
      <View style={[styles.deviceIndicator, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Volume2 size={11} color={PluginsTokens.colors.iconSpotify} />
        <Text style={[styles.deviceIndicatorText, { color: theme.textSecondary }]} numberOfLines={1}>
          Joy Robot Speaker
        </Text>
      </View>
    </View>
  );
}

export function SpotifyPreviewCardDJ({ testID = 'spotify-preview-card-dj' }: { testID?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.cardContent, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(29, 185, 84, 0.15)' }]}>
            <Sparkles size={12} color={PluginsTokens.colors.iconSpotify} />
          </View>
          <Text style={[styles.cardHeaderTitle, { color: theme.textTitle }]}>Smart Voice DJ</Text>
        </View>
      </View>

      {/* Chat Prompt */}
      <View style={[styles.promptBubble, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Text style={[styles.promptAuthor, { color: theme.textMuted }]}>Voice Request</Text>
        <Text style={[styles.promptText, { color: theme.textTitle }]}>
          &ldquo;Play upbeat instrumental music for deep work&rdquo;
        </Text>
      </View>

      {/* AI Recommendation Card */}
      <View style={[styles.playlistCard, { backgroundColor: 'rgba(29, 185, 84, 0.08)', borderColor: 'rgba(29, 185, 84, 0.25)' }]}>
        <View style={styles.playlistRow}>
          <View
            style={[
              styles.playlistThumb,
              {
                backgroundColor: 'rgba(29, 185, 84, 0.15)',
                borderColor: 'rgba(29, 185, 84, 0.3)',
                borderWidth: 1,
              },
            ]}
          >
            <Headphones size={14} color={PluginsTokens.colors.iconSpotify} />
          </View>
          <View style={styles.playlistInfo}>
            <Text style={[styles.playlistTitle, { color: theme.textTitle }]} numberOfLines={1}>
              Deep Focus Beats
            </Text>
            <Text style={[styles.playlistMeta, { color: PluginsTokens.colors.iconSpotify }]}>
              50 tracks • Curated by Joy
            </Text>
          </View>
        </View>
      </View>

      {/* Synced Badge */}
      <View style={[styles.deviceIndicator, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Sparkles size={11} color={PluginsTokens.colors.iconSpotify} />
        <Text style={[styles.deviceIndicatorText, { color: theme.textSecondary }]}>
          Continuous Spotify Auto-Queue
        </Text>
      </View>
    </View>
  );
}

export function SpotifyPreviewCardDevices({ testID = 'spotify-preview-card-devices' }: { testID?: string }) {
  const theme = useTheme();

  const devices = [
    { name: 'Joy Robot Speaker', status: 'Active device', active: true },
    { name: 'iPhone 15 Pro', status: 'Spotify Connect', active: false },
    { name: 'Living Room TV', status: 'Available', active: false },
  ];

  return (
    <View style={[styles.cardContent, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(29, 185, 84, 0.15)' }]}>
            <Radio size={12} color={PluginsTokens.colors.iconSpotify} />
          </View>
          <Text style={[styles.cardHeaderTitle, { color: theme.textTitle }]}>Device Connect</Text>
        </View>
      </View>

      {/* Device List */}
      <View style={styles.deviceList}>
        {devices.map((device, index) => (
          <View
            key={index}
            style={[
              styles.deviceRow,
              {
                backgroundColor: device.active ? 'rgba(29, 185, 84, 0.08)' : theme.background,
                borderColor: device.active ? 'rgba(29, 185, 84, 0.3)' : theme.border,
              },
            ]}
          >
            <View style={styles.deviceInfo}>
              <Text
                style={[
                  styles.deviceName,
                  { color: device.active ? PluginsTokens.colors.iconSpotify : theme.textTitle },
                ]}
                numberOfLines={1}
              >
                {device.name}
              </Text>
              <Text style={[styles.deviceStatus, { color: theme.textMuted }]}>{device.status}</Text>
            </View>
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor: device.active ? PluginsTokens.colors.iconSpotify : theme.border,
                },
              ]}
            >
              {device.active ? (
                <View style={[styles.radioInner, { backgroundColor: PluginsTokens.colors.iconSpotify }]} />
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Spotify Connect Footer */}
      <View style={[styles.deviceIndicator, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Radio size={11} color={theme.textSecondary} />
        <Text style={[styles.deviceIndicatorText, { color: theme.textSecondary }]}>
          Instant Audio Handoff
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  albumArtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  albumArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  vinylGroove: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  trackDetails: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 10,
  },
  progressContainer: {
    gap: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 2,
  },
  playButtonCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  deviceIndicatorText: {
    fontSize: 9,
    fontWeight: '500',
  },
  promptBubble: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  promptAuthor: {
    fontSize: 9,
    fontWeight: '600',
  },
  promptText: {
    fontSize: 11,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  playlistCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playlistThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  playlistMeta: {
    fontSize: 9,
    fontWeight: '600',
  },
  deviceList: {
    gap: 6,
    marginVertical: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 1,
  },
  deviceStatus: {
    fontSize: 8,
  },
  radioOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
