/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/lib/api';
import { asPlayback, asTrack, extractSearchItems, searchSpotifyTracks, sendSpotifyAction } from './spotify-api';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  isApiError: vi.fn().mockReturnValue(false),
}));
describe('spotify-api parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('asTrack', () => {
    it('normalizes a rich track object with nested album images and array of artist objects', () => {
      const payload = {
        id: 'track-123',
        name: 'High School in Jakarta',
        uri: 'spotify:track:track-123',
        artists: [{ name: 'NIKI' }, { name: 'Rich Brian' }],
        album: {
          id: 'album-456',
          name: 'Nicole',
          uri: 'spotify:album:album-456',
          images: [
            { url: 'https://i.scdn.co/image/ab67616d0000b273abc1', height: 640, width: 640 },
            { url: 'https://i.scdn.co/image/ab67616d00001e02abc2', height: 300, width: 300 },
          ],
        },
      };

      expect(asTrack(payload)).toEqual({
        uri: 'spotify:track:track-123',
        title: 'High School in Jakarta',
        artist: 'NIKI, Rich Brian',
        album: 'Nicole',
        imageUrl: 'https://i.scdn.co/image/ab67616d0000b273abc1',
        canvasVideoUrl: null,
      });
    });

    it('normalizes a track with string array of artists and direct imageUrl', () => {
      const payload = {
        id: 'track-789',
        title: 'lowkey',
        uri: 'spotify:track:track-789',
        artists: ['NIKI'],
        imageUrl: 'https://i.scdn.co/image/lowkey.jpg',
        album: 'wanna take this downtown?',
      };

      expect(asTrack(payload)).toEqual({
        uri: 'spotify:track:track-789',
        title: 'lowkey',
        artist: 'NIKI',
        album: 'wanna take this downtown?',
        imageUrl: 'https://i.scdn.co/image/lowkey.jpg',
        canvasVideoUrl: null,
      });
    });

    it('falls back to itemName and itemUri when standard title and uri are absent', () => {
      const payload = {
        itemName: 'Ocean & Engines',
        itemUri: 'spotify:track:ocean-1',
        artist: 'NIKI',
      };

      expect(asTrack(payload)).toEqual({
        uri: 'spotify:track:ocean-1',
        title: 'Ocean & Engines',
        artist: 'NIKI',
        album: null,
        imageUrl: null,
        canvasVideoUrl: null,
      });
    });

    it('extracts canvasVideoUrl when provided as canvasVideoUrl or canvasUrl', () => {
      const payload = {
        id: 'track-canvas',
        title: 'Teh Hijau',
        uri: 'spotify:track:teh-hijau',
        artists: [{ name: 'Tulus' }],
        album: { name: 'Manusia' },
        imageUrl: 'https://i.scdn.co/image/teh-hijau.jpg',
        canvasVideoUrl: 'https://canvaz.scdn.co/canvases/original/teh-hijau.mp4',
      };

      expect(asTrack(payload)).toEqual({
        uri: 'spotify:track:teh-hijau',
        title: 'Teh Hijau',
        artist: 'Tulus',
        album: 'Manusia',
        imageUrl: 'https://i.scdn.co/image/teh-hijau.jpg',
        canvasVideoUrl: 'https://canvaz.scdn.co/canvases/original/teh-hijau.mp4',
      });
    });

    it('returns null when input is not an object or lacks a title', () => {
      expect(asTrack(null)).toBeNull();
      expect(asTrack(undefined)).toBeNull();
      expect(asTrack({})).toBeNull();
      expect(asTrack({ artist: 'NIKI' })).toBeNull();
    });
  });

  describe('asPlayback', () => {
    it('parses rich backend playback state with track, device, and active state', () => {
      const backendResponse = {
        isPlaying: true,
        device: {
          id: 'dev-1',
          name: 'MSI',
          type: 'Computer',
          isActive: true,
          isRestricted: false,
        },
        track: {
          id: 't-1',
          name: 'Before',
          uri: 'spotify:track:t-1',
          artists: ['NIKI'],
          album: {
            id: 'al-1',
            name: 'Nicole',
            uri: 'spotify:album:al-1',
            images: [{ url: 'https://image.test/before.jpg' }],
          },
          imageUrl: 'https://image.test/before.jpg',
        },
        item: {
          id: 't-1',
          name: 'Before',
          uri: 'spotify:track:t-1',
          artists: ['NIKI'],
          album: {
            id: 'al-1',
            name: 'Nicole',
            uri: 'spotify:album:al-1',
            images: [{ url: 'https://image.test/before.jpg' }],
          },
          imageUrl: 'https://image.test/before.jpg',
        },
        contextUri: 'spotify:album:al-1',
        itemUri: 'spotify:track:t-1',
        itemName: 'Before',
        progressMs: 30000,
        durationMs: 210000,
        shuffleState: false,
        repeatState: 'off',
      };

      expect(asPlayback(backendResponse)).toEqual({
        isPlaying: true,
        track: {
          uri: 'spotify:track:t-1',
          title: 'Before',
          artist: 'NIKI',
          album: 'Nicole',
          imageUrl: 'https://image.test/before.jpg',
          canvasVideoUrl: null,
        },
        deviceId: 'dev-1',
        deviceName: 'MSI',
      });
    });

    it('falls back to itemName/itemUri when track object is null but itemName exists', () => {
      const legacyResponse = {
        isPlaying: true,
        device: {
          id: 'dev-2',
          name: 'Living Room',
        },
        track: null,
        itemName: 'Legacy Track Name',
        itemUri: 'spotify:track:legacy-1',
      };

      expect(asPlayback(legacyResponse)).toEqual({
        isPlaying: true,
        track: {
          uri: 'spotify:track:legacy-1',
          title: 'Legacy Track Name',
          artist: 'Unknown artist',
          album: null,
          imageUrl: null,
          canvasVideoUrl: null,
        },
        deviceId: 'dev-2',
        deviceName: 'Living Room',
      });
    });

    it('handles empty or paused playback response gracefully', () => {
      expect(asPlayback(null)).toEqual({
        isPlaying: false,
        track: null,
        deviceId: null,
        deviceName: null,
      });

      expect(asPlayback({ isPlaying: false })).toEqual({
        isPlaying: false,
        track: null,
        deviceId: null,
        deviceName: null,
      });
    });
  });

  describe('extractSearchItems', () => {
    it('extracts tracks from nested { results: { tracks: [...] } } payload', () => {
      const payload = {
        results: {
          tracks: [
            { id: '1', name: 'Song 1', uri: 'spotify:track:1' },
            { id: '2', name: 'Song 2', uri: 'spotify:track:2' },
          ],
        },
      };

      expect(extractSearchItems(payload)).toEqual([
        { id: '1', name: 'Song 1', uri: 'spotify:track:1' },
        { id: '2', name: 'Song 2', uri: 'spotify:track:2' },
      ]);
    });
  });

  describe('sendSpotifyAction', () => {
    it('throws descriptive error on flat FAILED status with PREMIUM_REQUIRED', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        id: 'action-1',
        action: 'PREVIOUS',
        status: 'FAILED',
        errorCode: 'PREMIUM_REQUIRED',
      });

      await expect(sendSpotifyAction('previous')).rejects.toThrow(
        'Spotify Premium is required to control playback or skip tracks.',
      );
    });

    it('throws descriptive error on flat FAILED status with NO_ACTIVE_DEVICE', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        id: 'action-2',
        action: 'RESUME',
        status: 'FAILED',
        errorCode: 'NO_ACTIVE_DEVICE',
      });

      await expect(sendSpotifyAction('play')).rejects.toThrow(
        'Open Spotify on a phone, laptop, or other device first.',
      );
    });

    it('throws descriptive error on nested FAILED action status', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        action: {
          status: 'FAILED',
          errorCode: 'PREMIUM_REQUIRED',
        },
      });

      await expect(sendSpotifyAction('next')).rejects.toThrow(
        'Spotify Premium is required to control playback or skip tracks.',
      );
    });

    it('returns null on successful action without playback payload', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        id: 'action-3',
        action: 'NEXT',
        status: 'SUCCEEDED',
        resultCode: 'SPOTIFY_COMMAND_ACCEPTED',
      });

      const result = await sendSpotifyAction('next');
      expect(result).toBeNull();
    });

    it('returns parsed playback on response containing playback data', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        isPlaying: true,
        track: {
          id: 't-1',
          name: 'Track A',
          uri: 'spotify:track:t-1',
        },
      });

      const result = await sendSpotifyAction('play');
      expect(result).toEqual({
        isPlaying: true,
        track: {
          uri: 'spotify:track:t-1',
          title: 'Track A',
          artist: 'Unknown artist',
          album: null,
          imageUrl: null,
          canvasVideoUrl: null,
        },
        deviceId: null,
        deviceName: null,
      });
    });
  });

  describe('searchSpotifyTracks', () => {
    it('returns empty array when query is empty or whitespace', async () => {
      expect(await searchSpotifyTracks('')).toEqual([]);
      expect(await searchSpotifyTracks('   ')).toEqual([]);
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('requests tracks endpoint with query and type=track', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        results: {
          tracks: [
            {
              id: 't-123',
              name: 'Kita Buat Menyenangkan',
              uri: 'spotify:track:t-123',
              artists: [{ name: 'Bernadya' }],
              album: {
                name: 'Sialnya, Hidup Harus Tetap Berjalan',
                images: [{ url: 'https://i.scdn.co/art.jpg' }],
              },
            },
          ],
        },
      });

      const hits = await searchSpotifyTracks('Kita Buat Menyenangkan');
      expect(apiRequest).toHaveBeenCalledWith(
        '/integrations/spotify/search?q=Kita%20Buat%20Menyenangkan&type=track',
      );
      expect(hits).toEqual([
        {
          uri: 'spotify:track:t-123',
          title: 'Kita Buat Menyenangkan',
          artist: 'Bernadya',
          imageUrl: 'https://i.scdn.co/art.jpg',
        },
      ]);
    });
  });
});
