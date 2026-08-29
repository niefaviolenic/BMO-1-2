import { isIntegrationConnected, type IntegrationStatus } from './plugin';

export type SpotifyConnection = {
  provider: 'spotify';
  status: IntegrationStatus;
  connectedAt: string | null;
  scopes: string[];
  displayName: string | null;
};

export type SpotifyPlaybackTrack = {
  uri: string | null;
  title: string;
  artist: string;
  album: string | null;
  imageUrl: string | null;
  canvasVideoUrl?: string | null;
};

export type SpotifyPlayback = {
  isPlaying: boolean;
  track: SpotifyPlaybackTrack | null;
  deviceId: string | null;
  deviceName: string | null;
};

export type SpotifyDevice = {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
  isRestricted: boolean;
};

export type SpotifySearchHit = {
  uri: string;
  title: string;
  artist: string;
  imageUrl: string | null;
};

export type SpotifyPlaybackAction = 'play' | 'pause' | 'next' | 'previous';

export function isSpotifyConnected(status: string | undefined): boolean {
  return isIntegrationConnected(status);
}
