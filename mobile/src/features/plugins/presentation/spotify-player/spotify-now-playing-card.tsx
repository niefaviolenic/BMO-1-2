import { Image } from 'expo-image';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
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
import { PluginsTokens } from '@/constants/theme';
import type {
  SpotifyPlayback,
  SpotifyPlaybackAction,
} from '@/features/plugins/domain/spotify';
export type SpotifyNowPlayingCardProps = {
  playback: SpotifyPlayback | null;
  disabled?: boolean;
  actingAction?: SpotifyPlaybackAction | null;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const tokens = PluginsTokens.spotifyPlayer;

export function SpotifyNowPlayingCard({
  playback,
  disabled = false,
  actingAction = null,
  onPlayPause,
  onNext,
  onPrevious,
  style,
  testID = 'spotify-now-playing',
}: SpotifyNowPlayingCardProps) {
  const theme = useTheme();
  const track = playback?.track ?? null;
  const isPlaying = playback?.isPlaying === true;
  const isPreviousLoading = actingAction === 'previous';
  const isPlayPauseLoading = actingAction === 'play' || actingAction === 'pause';
  const isNextLoading = actingAction === 'next';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <Text style={[styles.header, { color: theme.textMuted }]} testID={`${testID}-header`}>
        Now playing
      </Text>
      <View style={styles.row}>
        <View
          style={[styles.cover, { backgroundColor: theme.backgroundElement }]}
          testID={`${testID}-cover`}
        >
          {track?.imageUrl ? (
            <Image
              source={{ uri: track.imageUrl }}
              style={styles.coverImage}
              contentFit="cover"
              accessibilityLabel={track.title}
              testID={`${testID}-image`}
            />
          ) : (
            <View style={styles.coverFallback} />
          )}
        </View>
        <View style={styles.meta}>
          <Text
            style={[styles.title, { color: theme.text }]}
            numberOfLines={1}
            testID={`${testID}-title`}
          >
            {track?.title ?? 'Nothing playing'}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
            testID={`${testID}-artist`}
          >
            {track?.artist ?? 'Search or ask Joy in chat'}
          </Text>
          {playback?.deviceName ? (
            <Text
              style={[styles.device, { color: theme.textMuted }]}
              numberOfLines={1}
              testID={`${testID}-device`}
            >
              {playback.deviceName}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.transport} testID={`${testID}-transport`}>
        <Pressable
          onPress={onPrevious}
          disabled={disabled || isPreviousLoading}
          accessibilityRole="button"
          accessibilityLabel="Previous track"
          testID={`${testID}-previous`}
          style={({ pressed }) => [styles.transportButton, pressed && !disabled && styles.pressed]}
        >
          {isPreviousLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.text}
              testID={`${testID}-previous-spinner`}
            />
          ) : (
            <SkipBack
              size={tokens.transportIcon}
              color={theme.text}
              fill={theme.text}
            />
          )}
        </Pressable>
        <Pressable
          onPress={onPlayPause}
          disabled={disabled || isPlayPauseLoading}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          testID={`${testID}-play-pause`}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: theme.text },
            pressed && !disabled && styles.pressed,
          ]}
        >
          {isPlayPauseLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.background}
              testID={`${testID}-play-pause-spinner`}
            />
          ) : isPlaying ? (
            <Pause
              size={tokens.transportIcon}
              color={theme.background}
              fill={theme.background}
            />
          ) : (
            <Play
              size={tokens.transportIcon}
              color={theme.background}
              fill={theme.background}
            />
          )}
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={disabled || isNextLoading}
          accessibilityRole="button"
          accessibilityLabel="Next track"
          testID={`${testID}-next`}
          style={({ pressed }) => [styles.transportButton, pressed && !disabled && styles.pressed]}
        >
          {isNextLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.text}
              testID={`${testID}-next-spinner`}
            />
          ) : (
            <SkipForward
              size={tokens.transportIcon}
              color={theme.text}
              fill={theme.text}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 354,
    borderWidth: 1,
    borderRadius: tokens.cardRadius,
    padding: tokens.cardPadding,
    gap: 14,
  },
  header: {
    fontSize: tokens.headerFontSize,
    lineHeight: tokens.headerLineHeight,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    width: tokens.coverSize,
    height: tokens.coverSize,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    backgroundColor: PluginsTokens.colors.iconSpotify,
    opacity: 0.35,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: tokens.titleFontSize,
    lineHeight: tokens.titleLineHeight,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: tokens.subtitleFontSize,
    lineHeight: tokens.subtitleLineHeight,
  },
  device: {
    fontSize: 11,
    lineHeight: 14,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  transportButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
