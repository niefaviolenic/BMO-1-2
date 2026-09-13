/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { SpotifyConnection } from '../domain/spotify';
import { beginSpotifyOAuth } from './begin-spotify-oauth';
import { refreshPluginCatalog } from './plugin-catalog-store';
import {
  fetchSpotifyStatus,
  refreshSpotifyPlayer,
  startSpotifyConnect,
} from './spotify-session-store';

vi.mock('expo-linking', () => ({
  createURL: vi.fn().mockReturnValue('exp://127.0.0.1:8081/--/plugin-detail?id=spotify'),
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn().mockResolvedValue({ type: 'success' }),
}));

vi.mock('./plugin-catalog-store', () => ({
  refreshPluginCatalog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./spotify-session-store', () => ({
  fetchSpotifyStatus: vi.fn(),
  refreshSpotifyPlayer: vi.fn().mockResolvedValue(undefined),
  startSpotifyConnect: vi.fn(),
}));

describe('beginSpotifyOAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws error when Spotify connect is blocked on the server', async () => {
    vi.mocked(startSpotifyConnect).mockResolvedValueOnce({
      connection: {
        provider: 'spotify',
        status: 'DISCONNECTED',
        connectedAt: null,
        scopes: [],
      },
      authorizationUrl: null,
      blocked: true,
    });

    await expect(beginSpotifyOAuth()).rejects.toThrow('Spotify is not configured on the server.');
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(fetchSpotifyStatus).not.toHaveBeenCalled();
  });

  it('opens browser session and returns true when fresh connection status is CONNECTED', async () => {
    vi.mocked(startSpotifyConnect).mockResolvedValueOnce({
      connection: {
        provider: 'spotify',
        status: 'DISCONNECTED',
        connectedAt: null,
        scopes: [],
      },
      authorizationUrl: 'https://accounts.spotify.com/authorize?client_id=xyz',
      blocked: false,
    });

    const freshConnection: SpotifyConnection = {
      provider: 'spotify',
      status: 'CONNECTED',
      connectedAt: '2026-09-07T12:00:00Z',
      scopes: ['user-read-playback-state'],
    };
    vi.mocked(fetchSpotifyStatus).mockResolvedValueOnce(freshConnection);

    const result = await beginSpotifyOAuth();

    expect(Linking.createURL).toHaveBeenCalledWith('/plugin-detail', {
      queryParams: { id: 'spotify' },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.spotify.com/authorize?client_id=xyz',
      'exp://127.0.0.1:8081/--/plugin-detail?id=spotify',
    );
    expect(fetchSpotifyStatus).toHaveBeenCalledTimes(1);
    expect(refreshPluginCatalog).toHaveBeenCalledTimes(1);
    expect(refreshSpotifyPlayer).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('returns false and does not refresh player when fresh connection is still DISCONNECTED', async () => {
    vi.mocked(startSpotifyConnect).mockResolvedValueOnce({
      connection: {
        provider: 'spotify',
        status: 'DISCONNECTED',
        connectedAt: null,
        scopes: [],
      },
      authorizationUrl: 'https://accounts.spotify.com/authorize?client_id=xyz',
      blocked: false,
    });

    const freshConnection: SpotifyConnection = {
      provider: 'spotify',
      status: 'DISCONNECTED',
      connectedAt: null,
      scopes: [],
    };
    vi.mocked(fetchSpotifyStatus).mockResolvedValueOnce(freshConnection);

    const result = await beginSpotifyOAuth();

    expect(fetchSpotifyStatus).toHaveBeenCalledTimes(1);
    expect(refreshPluginCatalog).toHaveBeenCalledTimes(1);
    expect(refreshSpotifyPlayer).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('handles errors from refreshPluginCatalog and refreshSpotifyPlayer gracefully', async () => {
    vi.mocked(startSpotifyConnect).mockResolvedValueOnce({
      connection: {
        provider: 'spotify',
        status: 'DISCONNECTED',
        connectedAt: null,
        scopes: [],
      },
      authorizationUrl: 'https://accounts.spotify.com/authorize?client_id=xyz',
      blocked: false,
    });

    vi.mocked(fetchSpotifyStatus).mockResolvedValueOnce({
      provider: 'spotify',
      status: 'CONNECTED',
      connectedAt: '2026-09-07T12:00:00Z',
      scopes: [],
    });
    vi.mocked(refreshPluginCatalog).mockRejectedValueOnce(new Error('Catalog refresh failed'));
    vi.mocked(refreshSpotifyPlayer).mockRejectedValueOnce(new Error('Player refresh failed'));

    const result = await beginSpotifyOAuth();

    expect(result).toBe(true);
  });
});
