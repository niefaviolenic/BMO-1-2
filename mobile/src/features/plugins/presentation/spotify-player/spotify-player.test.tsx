/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpotifyDeviceList } from './spotify-device-list';
import { SpotifyNowPlayingCard } from './spotify-now-playing-card';
import { SpotifyPlayerPanel } from './spotify-player-panel';
import { SpotifySearchResults } from './spotify-search-results';

vi.mock('react', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState: vi.fn((initial: any) => [initial, vi.fn()]),
    useEffect: vi.fn(),
  };
});
type MockProps = {
  children?: React.ReactNode;
  style?: unknown;
  testID?: string;
  [key: string]: unknown;
};
let currentMockTheme = {
  background: '#000000',
  backgroundSecondary: '#121316',
  backgroundElement: '#1E2025',
  cardBackground: '#18191D',
  border: '#2A2D35',
  divider: '#22252C',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  icon: '#F8FAFC',
};

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => currentMockTheme,
}));

vi.mock('expo-image', () => ({
  Image: (props: MockProps) => ({ type: 'Image', props }),
}));

vi.mock('lucide-react-native', () => ({
  Pause: (props: MockProps) => ({ type: 'Pause', props }),
  Play: (props: MockProps) => ({ type: 'Play', props }),
  SkipBack: (props: MockProps) => ({ type: 'SkipBack', props }),
  SkipForward: (props: MockProps) => ({ type: 'SkipForward', props }),
  Volume2: (props: MockProps) => ({ type: 'Volume2', props }),
}));
vi.mock('react-native', () => ({
  Platform: {
    select: (obj: any) => obj.default ?? obj.ios ?? obj.android,
  },
  View: (props: MockProps) => ({ type: 'View', props }),
  Text: (props: MockProps) => ({ type: 'Text', props }),
  Pressable: (props: MockProps) => ({ type: 'Pressable', props }),
  ActivityIndicator: (props: MockProps) => ({ type: 'ActivityIndicator', props }),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Alert: {
    alert: vi.fn(),
  },
}));

vi.mock('@/components/ui/search-input', () => ({
  SearchInput: (props: MockProps) => ({ type: 'SearchInput', props }),
}));

vi.mock('@/features/plugins/data/use-spotify-session', () => ({
  useSpotifySession: () => ({
    playback: {
      isPlaying: true,
      track: {
        id: 'track-1',
        title: 'Song Title',
        artist: 'Artist Name',
        imageUrl: 'https://example.com/art.jpg',
      },
      deviceName: 'Living Room Speaker',
    },
    devices: [
      { id: 'dev-1', name: 'Living Room Speaker', type: 'Speaker', isActive: true, isRestricted: false },
    ],
    activeDeviceId: 'dev-1',
    searchResults: [],
    searchQuery: '',
    isSearching: false,
    isActing: false,
    isConnecting: false,
  }),
}));

vi.mock('@/features/plugins/data/spotify-session-store', () => ({
  runSpotifyAction: vi.fn().mockResolvedValue(undefined),
  runSpotifySearch: vi.fn().mockResolvedValue(undefined),
  selectSpotifyDevice: vi.fn().mockResolvedValue(undefined),
}));

function findByTestId(node: any, testID: string): any {
  if (!node) return null;
  if (node.props?.testID === testID) return node;
  const children = React.Children.toArray(node.props?.children);
  for (const child of children) {
    const found = findByTestId(child, testID);
    if (found) return found;
  }
  return null;
}

describe('Spotify Player Theme Support', () => {
  beforeEach(() => {
    currentMockTheme = {
      background: '#000000',
      backgroundSecondary: '#121316',
      backgroundElement: '#1E2025',
      cardBackground: '#18191D',
      border: '#2A2D35',
      divider: '#22252C',
      text: '#FFFFFF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      icon: '#F8FAFC',
    };
  });

  it('renders SpotifyNowPlayingCard with dynamic dark theme colors', () => {
    const tree = SpotifyNowPlayingCard({
      playback: {
        isPlaying: true,
        track: {
          uri: 'spotify:track:1',
          title: 'Starboy',
          artist: 'The Weeknd',
          album: 'Starboy',
          imageUrl: 'https://example.com/cover.png',
        },
        deviceId: 'dev-1',
        deviceName: 'Phone',
      },
      testID: 'now-playing',
    }) as any;

    expect(tree).toBeDefined();
    const styles = Array.isArray(tree.props.style) ? tree.props.style : [tree.props.style];
    const dynamicCardStyle = styles.find((s: any) => s?.backgroundColor === currentMockTheme.cardBackground);
    expect(dynamicCardStyle).toBeDefined();
    expect(dynamicCardStyle.borderColor).toBe(currentMockTheme.border);

    const titleNode = findByTestId(tree, 'now-playing-title');
    expect(titleNode).toBeDefined();
    const titleStyles = Array.isArray(titleNode.props.style) ? titleNode.props.style : [titleNode.props.style];
    expect(titleStyles.some((s: any) => s?.color === currentMockTheme.text)).toBe(true);

    const artistNode = findByTestId(tree, 'now-playing-artist');
    expect(artistNode).toBeDefined();
    const artistStyles = Array.isArray(artistNode.props.style) ? artistNode.props.style : [artistNode.props.style];
    expect(artistStyles.some((s: any) => s?.color === currentMockTheme.textSecondary)).toBe(true);
  });

  it('renders SpotifyNowPlayingCard with dynamic light theme colors', () => {
    currentMockTheme = {
      background: '#FFFFFF',
      backgroundSecondary: '#F4F4F7',
      backgroundElement: '#F0F0F3',
      cardBackground: '#FFFFFF',
      border: '#E3E8F0',
      divider: '#EDF0F5',
      text: '#000000',
      textSecondary: '#60646C',
      textMuted: '#808794',
      icon: '#0F1729',
    };

    const tree = SpotifyNowPlayingCard({
      playback: {
        isPlaying: false,
        track: {
          uri: 'spotify:track:1',
          title: 'Starboy',
          artist: 'The Weeknd',
          album: 'Starboy',
          imageUrl: null,
        },
        deviceId: 'dev-1',
        deviceName: 'Phone',
      },
      testID: 'now-playing',
    }) as any;

    expect(tree).toBeDefined();
    const styles = Array.isArray(tree.props.style) ? tree.props.style : [tree.props.style];
    const dynamicCardStyle = styles.find((s: any) => s?.backgroundColor === '#FFFFFF');
    expect(dynamicCardStyle).toBeDefined();
    expect(dynamicCardStyle.borderColor).toBe('#E3E8F0');
  });

  it('renders SpotifyDeviceList with dark theme colors', () => {
    const tree = SpotifyDeviceList({
      devices: [
        { id: '1', name: 'My Echo', type: 'Speaker', isActive: true, isRestricted: false },
      ],
      activeDeviceId: '1',
      testID: 'device-list',
    }) as any;

    expect(tree).toBeDefined();
    const cardNode = tree.props.children[1];
    const cardStyles = Array.isArray(cardNode.props.style) ? cardNode.props.style : [cardNode.props.style];
    const dynamicCardStyle = cardStyles.find((s: any) => s?.backgroundColor === currentMockTheme.cardBackground);
    expect(dynamicCardStyle).toBeDefined();
  });

  it('renders SpotifySearchResults with dark theme colors', () => {
    const tree = SpotifySearchResults({
      results: [
        { uri: 'spotify:track:1', title: 'Blinding Lights', artist: 'The Weeknd', imageUrl: null },
      ],
      isSearching: false,
      testID: 'search-results',
    }) as any;

    expect(tree).toBeDefined();
    const cardNode = tree.props.children[1];
    const cardStyles = Array.isArray(cardNode.props.style) ? cardNode.props.style : [cardNode.props.style];
    const dynamicCardStyle = cardStyles.find((s: any) => s?.backgroundColor === currentMockTheme.cardBackground);
    expect(dynamicCardStyle).toBeDefined();
  });

  it('renders SpotifyPlayerPanel with hint text', () => {
    const tree = SpotifyPlayerPanel({
      testID: 'player-panel',
    }) as any;

    expect(tree).toBeDefined();
    const hintNode = findByTestId(tree, 'player-panel-hint');
    expect(hintNode).toBeDefined();
    const hintStyles = Array.isArray(hintNode.props.style) ? hintNode.props.style : [hintNode.props.style];
    expect(hintStyles.some((s: any) => s?.color === currentMockTheme.textMuted)).toBe(true);
  });

  it('renders indicator and active color when track matches currently playing URI', () => {
    const tree = SpotifySearchResults({
      results: [
        { uri: 'spotify:track:1', title: 'Teh Hijau', artist: 'Tulus', imageUrl: null },
        { uri: 'spotify:track:2', title: 'Jatuh Suka', artist: 'Tulus', imageUrl: null },
      ],
      currentTrackUri: 'spotify:track:1',
      isSearching: false,
      testID: 'search-results',
    }) as any;

    expect(tree).toBeDefined();
    const activeTitle = findByTestId(tree, 'search-results-item-0-title');
    expect(activeTitle).toBeDefined();
    const activeStyles = Array.isArray(activeTitle.props.style) ? activeTitle.props.style : [activeTitle.props.style];
    expect(activeStyles.some((s: any) => s?.color === '#1DB954')).toBe(true);

    const activeIndicator = findByTestId(tree, 'search-results-item-0-indicator');
    expect(activeIndicator).toBeDefined();

    const activeIndicatorIcon = findByTestId(tree, 'search-results-item-0-indicator-icon');
    expect(activeIndicatorIcon).toBeDefined();
    expect(activeIndicatorIcon.props.color).toBe('#1DB954');

    // Second item should not have indicator
    const inactiveIndicator = findByTestId(tree, 'search-results-item-1-indicator');
    expect(inactiveIndicator).toBeNull();
    const inactiveTitle = findByTestId(tree, 'search-results-item-1-title');
    const inactiveStyles = Array.isArray(inactiveTitle.props.style) ? inactiveTitle.props.style : [inactiveTitle.props.style];
    expect(inactiveStyles.some((s: any) => s?.color === currentMockTheme.text)).toBe(true);
  });

  it('matches currently playing track by title and artist fallback when URI is omitted', () => {
    const tree = SpotifySearchResults({
      results: [
        { uri: 'spotify:track:1', title: 'Teh Hijau', artist: 'Tulus', imageUrl: null },
        { uri: 'spotify:track:2', title: 'Jatuh Suka', artist: 'Tulus', imageUrl: null },
      ],
      currentTrackTitle: 'Teh Hijau',
      currentTrackArtist: 'Tulus',
      isSearching: false,
      testID: 'search-results',
    }) as any;

    expect(tree).toBeDefined();
    const activeIndicator = findByTestId(tree, 'search-results-item-0-indicator');
    expect(activeIndicator).toBeDefined();

    const inactiveIndicator = findByTestId(tree, 'search-results-item-1-indicator');
    expect(inactiveIndicator).toBeNull();
  });

  it('renders Image cover in Now Playing card', () => {
    const tree = SpotifyNowPlayingCard({
      playback: {
        isPlaying: true,
        track: {
          uri: 'spotify:track:t-1',
          title: 'Teh Hijau',
          artist: 'Tulus',
          album: 'Manusia',
          imageUrl: 'https://image.test/teh-hijau.jpg',
        },
        deviceId: 'dev-1',
        deviceName: 'MSI',
      },
      testID: 'spotify-now-playing',
    }) as unknown as { props: { children: unknown } };

    expect(tree).toBeDefined();
    const imageNode = findByTestId(tree, 'spotify-now-playing-image');
    expect(imageNode).toBeDefined();
    expect(imageNode.props.source).toEqual({ uri: 'https://image.test/teh-hijau.jpg' });
    expect(imageNode.props.contentFit).toBe('cover');
    expect(imageNode.props.accessibilityLabel).toBe('Teh Hijau');
  });

  it('renders spinner when previous, play/pause, or next is acting', () => {
    const prevTree = SpotifyNowPlayingCard({
      playback: {
        isPlaying: true,
        track: { uri: 'spotify:track:1', title: 'Song', artist: 'Artist', album: 'Album', imageUrl: null },
        deviceId: 'dev-1',
        deviceName: 'MSI',
      },
      actingAction: 'previous',
      testID: 'spotify-now-playing',
    }) as any;
    expect(findByTestId(prevTree, 'spotify-now-playing-previous-spinner')).toBeDefined();

    const playTree = SpotifyNowPlayingCard({
      playback: {
        isPlaying: false,
        track: { uri: 'spotify:track:1', title: 'Song', artist: 'Artist', album: 'Album', imageUrl: null },
        deviceId: 'dev-1',
        deviceName: 'MSI',
      },
      actingAction: 'play',
      testID: 'spotify-now-playing',
    }) as any;
    expect(findByTestId(playTree, 'spotify-now-playing-play-pause-spinner')).toBeDefined();

    const nextTree = SpotifyNowPlayingCard({
      playback: {
        isPlaying: true,
        track: { uri: 'spotify:track:1', title: 'Song', artist: 'Artist', album: 'Album', imageUrl: null },
        deviceId: 'dev-1',
        deviceName: 'MSI',
      },
      actingAction: 'next',
      testID: 'spotify-now-playing',
    }) as any;
    expect(findByTestId(nextTree, 'spotify-now-playing-next-spinner')).toBeDefined();
  });

  it('renders spinner on search result track when loadingTrackUri matches', () => {
    const tree = SpotifySearchResults({
      results: [
        { uri: 'spotify:track:1', title: 'Laut yang Tenang', artist: 'Bernadya', imageUrl: null },
        { uri: 'spotify:track:2', title: 'Rabun Jauh', artist: 'Bernadya', imageUrl: null },
      ],
      loadingTrackUri: 'spotify:track:1',
      isSearching: false,
      testID: 'search-results',
    }) as any;

    const spinner = findByTestId(tree, 'search-results-item-0-spinner');
    expect(spinner).toBeDefined();

    const item1Spinner = findByTestId(tree, 'search-results-item-1-spinner');
    expect(item1Spinner).toBeNull();
  });
});
