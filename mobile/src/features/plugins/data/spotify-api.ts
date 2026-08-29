import { createUuid } from '@/features/chat/data/uuid';
import { apiRequest } from '@/lib/api';

import type { IntegrationStatus } from '../domain/plugin';
import type {
  SpotifyConnection,
  SpotifyDevice,
  SpotifyPlayback,
  SpotifyPlaybackAction,
  SpotifyPlaybackTrack,
  SpotifySearchHit,
} from '../domain/spotify';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStatus(value: unknown): IntegrationStatus {
  if (
    value === 'CONNECTED' ||
    value === 'DISCONNECTED' ||
    value === 'PENDING' ||
    value === 'ERROR' ||
    value === 'RECONNECT_REQUIRED'
  ) {
    return value;
  }
  return 'DISCONNECTED';
}

function asConnection(value: unknown): SpotifyConnection {
  const record = isRecord(value) && isRecord(value.connection) ? value.connection : value;
  if (!isRecord(record)) {
    return {
      provider: 'spotify',
      status: 'DISCONNECTED',
      connectedAt: null,
      scopes: [],
      displayName: null,
    };
  }

  return {
    provider: 'spotify',
    status: asStatus(record.status),
    connectedAt: asString(record.connectedAt) ?? asString(record.connected_at),
    scopes: Array.isArray(record.scopes)
      ? record.scopes.filter((item): item is string => typeof item === 'string')
      : [],
    displayName:
      asString(record.displayName) ??
      asString(record.display_name) ??
      asString(record.userName) ??
      asString(record.user_name),
  };
}

function asAuthorizationUrl(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return (
    asString(value.authorizationUrl) ??
    asString(value.authorization_url) ??
    asString(value.authUrl) ??
    asString(value.url) ??
    asString(value.connectUrl)
  );
}

function firstImageUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const first = value[0];
  if (typeof first === 'string') {
    return first;
  }
  if (isRecord(first)) {
    return asString(first.url) ?? asString(first.uri);
  }
  return null;
}

function artistLabel(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Array.isArray(value)) {
    const names = value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (isRecord(item)) {
          return asString(item.name);
        }
        return null;
      })
      .filter((item): item is string => item != null);
    if (names.length > 0) {
      return names.join(', ');
    }
  }
  return 'Unknown artist';
}

export function asTrack(value: unknown): SpotifyPlaybackTrack | null {
  if (!isRecord(value)) {
    return null;
  }

  const album = isRecord(value.album) ? value.album : null;
  const title =
    asString(value.title) ??
    asString(value.name) ??
    asString(value.trackName) ??
    asString(value.itemName);
  if (!title) {
    return null;
  }

  return {
    uri:
      asString(value.uri) ??
      asString(value.spotifyUri) ??
      asString(value.id) ??
      asString(value.itemUri),
    title,
    artist: artistLabel(value.artists ?? value.artist ?? value.artistName),
    album: album ? asString(album.name) ?? asString(album.title) : asString(value.album),
    imageUrl:
      firstImageUrl(value.imageUrl) ??
      firstImageUrl(value.albumArtUrl) ??
      firstImageUrl(value.images) ??
      (album ? firstImageUrl(album.images) ?? asString(album.imageUrl) : null),
    canvasVideoUrl:
      asString(value.canvasVideoUrl) ??
      asString(value.canvasUrl) ??
      asString(value.videoUrl) ??
      null,
  };
}

export function asPlayback(value: unknown): SpotifyPlayback {
  const record = isRecord(value) && isRecord(value.playback) ? value.playback : value;
  if (!isRecord(record)) {
    return { isPlaying: false, track: null, deviceId: null, deviceName: null };
  }

  const item =
    record.track ??
    record.item ??
    record.currentlyPlaying ??
    (record.itemName ? { title: record.itemName, uri: record.itemUri } : null);
  const device = isRecord(record.device) ? record.device : null;

  return {
    isPlaying: record.isPlaying === true || record.is_playing === true,
    track: asTrack(item),
    deviceId: asString(record.deviceId) ?? (device ? asString(device.id) : null),
    deviceName: asString(record.deviceName) ?? (device ? asString(device.name) : null),
  };
}

function asDevice(value: unknown): SpotifyDevice | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }

  return {
    id: value.id,
    name: asString(value.name) ?? 'Spotify device',
    type: asString(value.type),
    isActive: value.isActive === true || value.is_active === true,
    isRestricted: value.isRestricted === true || value.is_restricted === true,
  };
}

function asSearchHit(value: unknown): SpotifySearchHit | null {
  const track = asTrack(value);
  if (!track?.uri) {
    return null;
  }
  return {
    uri: track.uri,
    title: track.title,
    artist: track.artist,
    imageUrl: track.imageUrl,
  };
}

export function extractSearchItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return [];
  }
  if (Array.isArray(value.items)) {
    return value.items;
  }
  if (Array.isArray(value.results)) {
    return value.results;
  }
  if (Array.isArray(value.tracks)) {
    return value.tracks;
  }
  if (isRecord(value.tracks) && Array.isArray(value.tracks.items)) {
    return value.tracks.items;
  }
  if (isRecord(value.results)) {
    return extractSearchItems(value.results);
  }
  return [];
}

export type ConnectSpotifyResult = {
  connection: SpotifyConnection;
  authorizationUrl: string | null;
  blocked: boolean;
};

export async function connectSpotify(returnTo?: string): Promise<ConnectSpotifyResult> {
  const payload = await apiRequest<unknown>('/integrations/spotify/connect', {
    method: 'POST',
    body: returnTo ? { returnTo } : {},
  });
  return {
    connection: asConnection(payload),
    authorizationUrl: asAuthorizationUrl(payload),
    blocked: isRecord(payload) && payload.blocked === true,
  };
}

export async function fetchSpotifyStatus(): Promise<SpotifyConnection> {
  return asConnection(await apiRequest<unknown>('/integrations/spotify/status'));
}

export async function disconnectSpotify(): Promise<void> {
  await apiRequest<void>('/integrations/spotify/disconnect', {
    method: 'POST',
    body: {},
  });
}

export async function searchSpotifyTracks(query: string): Promise<SpotifySearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const payload = await apiRequest<unknown>(
    `/integrations/spotify/search?q=${encodeURIComponent(trimmed)}&type=track`,
  );
  return extractSearchItems(payload)
    .map(asSearchHit)
    .filter((item): item is SpotifySearchHit => item != null);
}

export async function fetchSpotifyDevices(): Promise<SpotifyDevice[]> {
  const payload = await apiRequest<unknown>('/integrations/spotify/devices');
  const items = isRecord(payload) && Array.isArray(payload.devices) ? payload.devices : [];
  return items.map(asDevice).filter((item): item is SpotifyDevice => item != null);
}

export async function fetchSpotifyActiveDevice(): Promise<SpotifyDevice | null> {
  const payload = await apiRequest<unknown>('/integrations/spotify/active-device');
  const record = isRecord(payload) && isRecord(payload.device) ? payload.device : payload;
  return asDevice(record);
}

export async function fetchSpotifyPlayback(): Promise<SpotifyPlayback> {
  return asPlayback(await apiRequest<unknown>('/integrations/spotify/playback'));
}

export async function setSpotifyPreferredDevice(deviceId: string): Promise<void> {
  await apiRequest<void>('/integrations/spotify/preferred-device', {
    method: 'PUT',
    body: { deviceId },
  });
}

export async function sendSpotifyAction(
  action: SpotifyPlaybackAction,
  options: { uri?: string; deviceId?: string } = {},
): Promise<SpotifyPlayback | null> {
  const backendAction =
    action === 'play'
      ? options.uri
        ? 'PLAY_TRACK'
        : 'RESUME'
      : action === 'pause'
        ? 'PAUSE'
        : action === 'next'
          ? 'NEXT'
          : 'PREVIOUS';

  const payload: Record<string, unknown> = {};
  if (options.uri) {
    payload.uri = options.uri;
  }
  if (options.deviceId) {
    payload.deviceId = options.deviceId;
  }

  const response = await apiRequest<unknown>('/integrations/spotify/actions', {
    method: 'POST',
    body: {
      action: backendAction,
      idempotencyKey: createUuid(),
      payload,
      confirmed: true,
    },
  });

  if (response == null) {
    return null;
  }

  const status =
    isRecord(response) && isRecord(response.action)
      ? asString(response.action.status)
      : isRecord(response)
        ? asString(response.status)
        : null;

  const errorCode =
    isRecord(response) && isRecord(response.action)
      ? asString(response.action.errorCode)
      : isRecord(response)
        ? asString(response.errorCode)
        : null;

  if (status === 'FAILED') {
    const code = errorCode ?? 'PROVIDER_REQUEST_FAILED';
    const message =
      code === 'PREMIUM_REQUIRED'
        ? 'Spotify Premium is required to control playback or skip tracks.'
        : code === 'NO_ACTIVE_DEVICE'
          ? 'Open Spotify on a phone, laptop, or other device first.'
          : `Spotify action failed (${code})`;
    const error = new Error(message);
    (error as { code?: string }).code = code;
    throw error;
  }

  const hasPlaybackData =
    isRecord(response) &&
    (isRecord(response.playback) ||
      isRecord(response.track) ||
      isRecord(response.item) ||
      typeof response.isPlaying === 'boolean' ||
      typeof response.is_playing === 'boolean');

  return hasPlaybackData ? asPlayback(response) : null;
}
