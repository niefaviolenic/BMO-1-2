import { Image } from 'expo-image';
import { Volume2 } from 'lucide-react-native';
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
import type { SpotifySearchHit } from '@/features/plugins/domain/spotify';

export type SpotifySearchResultsProps = {
  results: SpotifySearchHit[];
  isSearching?: boolean;
  disabled?: boolean;
  loadingTrackUri?: string | null;
  currentTrackUri?: string | null;
  currentTrackTitle?: string | null;
  currentTrackArtist?: string | null;
  isPlaying?: boolean;
  onSelect?: (uri: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
const tokens = PluginsTokens.spotifyPlayer;

export function SpotifySearchResults({
  results,
  isSearching = false,
  disabled = false,
  loadingTrackUri = null,
  currentTrackUri,
  currentTrackTitle,
  currentTrackArtist,
  isPlaying = false,
  onSelect,
  style,
  testID = 'spotify-search-results',
}: SpotifySearchResultsProps) {
  const theme = useTheme();

  if (!isSearching && results.length === 0) {
    return null;
  }

  return (
    <View style={[styles.section, style]} testID={testID}>
      <Text style={[styles.header, { color: theme.textMuted }]}>Search results</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
      >
        {isSearching && results.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]} testID={`${testID}-loading`}>
            Searching…
          </Text>
        ) : (
          results.map((hit, index) => {
            const isUriMatch = Boolean(
              currentTrackUri &&
                (hit.uri === currentTrackUri ||
                  hit.uri.endsWith(currentTrackUri) ||
                  currentTrackUri.endsWith(hit.uri))
            );
            const isNameMatch = Boolean(
              currentTrackTitle &&
                hit.title.trim().toLowerCase() === currentTrackTitle.trim().toLowerCase() &&
                (!currentTrackArtist ||
                  hit.artist.trim().toLowerCase() === currentTrackArtist.trim().toLowerCase() ||
                  hit.artist.toLowerCase().includes(currentTrackArtist.toLowerCase()) ||
                  currentTrackArtist.toLowerCase().includes(hit.artist.toLowerCase()))
            );
            const isSelected = isUriMatch || isNameMatch;
            const isLoadingThisTrack = loadingTrackUri === hit.uri;
            return (
              <Pressable
                key={hit.uri}
                onPress={() => onSelect?.(hit.uri)}
                disabled={disabled || isLoadingThisTrack}
                accessibilityRole="button"
                accessibilityLabel={`${hit.title} by ${hit.artist}${isSelected ? ' (Currently playing)' : ''}`}
                testID={`${testID}-item-${index}`}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && [styles.rowDivider, { borderTopColor: theme.divider }],
                  pressed && !disabled && styles.pressed,
                ]}
              >
                <View
                  style={[styles.cover, { backgroundColor: theme.backgroundElement }]}
                >
                  {hit.imageUrl ? (
                    <Image
                      source={{ uri: hit.imageUrl }}
                      style={styles.coverImage}
                      contentFit="cover"
                      accessibilityLabel={hit.title}
                    />
                  ) : (
                    <View style={styles.coverFallback} />
                  )}
                </View>
                <View style={styles.meta}>
                  <Text
                    style={[
                      styles.title,
                      { color: isSelected || isLoadingThisTrack ? tokens.activeColor : theme.text },
                    ]}
                    testID={`${testID}-item-${index}-title`}
                  >
                    {hit.title}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {hit.artist}
                  </Text>
                </View>
                {isLoadingThisTrack ? (
                  <View
                    style={styles.indicator}
                    testID={`${testID}-item-${index}-spinner`}
                  >
                    <ActivityIndicator
                      size="small"
                      color={tokens.activeColor}
                      testID={`${testID}-item-${index}-spinner-icon`}
                    />
                  </View>
                ) : isSelected ? (
                  <View
                    style={styles.indicator}
                    testID={`${testID}-item-${index}-indicator`}
                  >
                    <Volume2
                      size={tokens.indicatorIconSize}
                      color={tokens.activeColor}
                      testID={`${testID}-item-${index}-indicator-icon`}
                    />
                  </View>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    backgroundColor: PluginsTokens.colors.iconSpotify,
    opacity: 0.3,
  },
  meta: {
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
  pressed: {
    opacity: 0.7,
  },
  indicator: {
    paddingLeft: tokens.indicatorPaddingLeft,
    paddingRight: tokens.indicatorPaddingRight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
