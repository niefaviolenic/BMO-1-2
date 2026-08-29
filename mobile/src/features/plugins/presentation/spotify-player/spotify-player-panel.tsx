import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SearchInput } from '@/components/ui/search-input';
import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
import { useSpotifySession } from '@/features/plugins/data/use-spotify-session';
import {
  runSpotifyAction,
  runSpotifySearch,
  selectSpotifyDevice,
} from '@/features/plugins/data/spotify-session-store';
import { mapPluginApiError } from '@/features/plugins/domain/plugin';

import { SpotifyDeviceList } from './spotify-device-list';
import { SpotifyNowPlayingCard } from './spotify-now-playing-card';
import { SpotifySearchResults } from './spotify-search-results';

export type SpotifyPlayerPanelProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export function SpotifyPlayerPanel({
  style,
  testID = 'spotify-player-panel',
}: SpotifyPlayerPanelProps) {
  const theme = useTheme();
  const session = useSpotifySession();
  const [draftQuery, setDraftQuery] = useState(session.searchQuery);
  const [loadingTrackUri, setLoadingTrackUri] = useState<string | null>(null);
  const busy = session.isActing || session.isConnecting;
  useEffect(() => {
    const trimmed = draftQuery.trim();
    const timer = setTimeout(() => {
      void runSpotifySearch(draftQuery).catch((error) => {
        Alert.alert('Unable to search Spotify', mapPluginApiError(error));
      });
    }, trimmed ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [draftQuery]);

  const handleError = (title: string, error: unknown) => {
    Alert.alert(title, mapPluginApiError(error));
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <SpotifyNowPlayingCard
        playback={session.playback}
        disabled={busy}
        actingAction={session.actingAction}
        onPlayPause={() => {
          void runSpotifyAction(session.playback?.isPlaying ? 'pause' : 'play', {
            deviceId: session.activeDeviceId ?? session.playback?.deviceId ?? undefined,
          }).catch((error) => {
            handleError('Unable to update playback', error);
          });
        }}
        onNext={() => {
          void runSpotifyAction('next', {
            deviceId: session.activeDeviceId ?? session.playback?.deviceId ?? undefined,
          }).catch((error) => {
            handleError('Unable to skip track', error);
          });
        }}
        onPrevious={() => {
          void runSpotifyAction('previous', {
            deviceId: session.activeDeviceId ?? session.playback?.deviceId ?? undefined,
          }).catch((error) => {
            handleError('Unable to go to previous track', error);
          });
        }}
        testID={`${testID}-now-playing`}
      />

      <SearchInput
        value={draftQuery}
        onChangeText={setDraftQuery}
        placeholder="Search songs"
        variant="pill"
        testID={`${testID}-search`}
      />

      <SpotifySearchResults
        results={session.searchResults}
        isSearching={session.isSearching}
        disabled={busy}
        loadingTrackUri={loadingTrackUri}
        currentTrackUri={session.playback?.track?.uri}
        currentTrackTitle={session.playback?.track?.title}
        currentTrackArtist={session.playback?.track?.artist}
        isPlaying={session.playback?.isPlaying}
        onSelect={(uri) => {
          setLoadingTrackUri(uri);
          void runSpotifyAction('play', { uri })
            .catch((error) => {
              handleError('Unable to play that track', error);
            })
            .finally(() => {
              setLoadingTrackUri(null);
            });
        }}
        testID={`${testID}-results`}
      />

      <SpotifyDeviceList
        devices={session.devices}
        activeDeviceId={session.activeDeviceId}
        disabled={busy}
        onSelect={(deviceId) => {
          void selectSpotifyDevice(deviceId).catch((error) => {
            handleError('Unable to change device', error);
          });
        }}
        testID={`${testID}-devices`}
      />

      <Text style={[styles.hint, { color: theme.textMuted }]} testID={`${testID}-hint`}>
        You can also tell Joy in chat: play, pause, or skip.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 354,
    alignItems: 'center',
    gap: PluginsTokens.spotifyPlayer.sectionGap,
  },
  hint: {
    width: '100%',
    fontSize: PluginsTokens.spotifyPlayer.subtitleFontSize,
    lineHeight: PluginsTokens.spotifyPlayer.subtitleLineHeight,
    color: PluginsTokens.colors.textMuted,
    textAlign: 'center',
  },
});
