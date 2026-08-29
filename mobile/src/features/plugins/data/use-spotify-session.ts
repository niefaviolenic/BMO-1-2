import { useSyncExternalStore } from 'react';

import {
  getSpotifySessionState,
  subscribeSpotifySession,
} from './spotify-session-store';

export function useSpotifySession() {
  return useSyncExternalStore(
    subscribeSpotifySession,
    getSpotifySessionState,
    getSpotifySessionState,
  );
}
