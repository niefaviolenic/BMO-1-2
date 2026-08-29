import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isSpotifyConnected } from '../domain/spotify';

import { startSpotifyConnect } from './spotify-session-store';

WebBrowser.maybeCompleteAuthSession();

export async function beginSpotifyOAuth(): Promise<boolean> {
  const returnTo = Linking.createURL('/plugin-detail', {
    queryParams: { id: 'spotify' },
  });
  const result = await startSpotifyConnect(returnTo);
  if (result.blocked) {
    throw new Error('Spotify is not configured on the server.');
  }
  if (result.authorizationUrl) {
    await WebBrowser.openAuthSessionAsync(result.authorizationUrl, returnTo);
  }
  return isSpotifyConnected(result.connection.status);
}
