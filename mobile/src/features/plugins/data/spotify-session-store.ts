import {
  isApiError,
  isIntegrationStatusEvent,
  subscribeMobileWebSocket,
  type MobileInboundEvent,
} from '@/lib/api';

import { isSpotifyConnected } from '../domain/spotify';
import type {
  SpotifyConnection,
  SpotifyDevice,
  SpotifyPlayback,
  SpotifyPlaybackAction,
  SpotifySearchHit,
} from '../domain/spotify';

import {
  markCatalogPluginDisconnected,
  refreshPluginCatalog,
  setCatalogMutating,
} from './plugin-catalog-store';
import {
  connectSpotify,
  type ConnectSpotifyResult,
  disconnectSpotify as disconnectSpotifyRequest,
  fetchSpotifyActiveDevice,
  fetchSpotifyDevices,
  fetchSpotifyPlayback,
  fetchSpotifyStatus,
  searchSpotifyTracks,
  sendSpotifyAction,
  setSpotifyPreferredDevice,
} from './spotify-api';

type Listener = () => void;

export type SpotifySessionState = {
  connection: SpotifyConnection | null;
  playback: SpotifyPlayback | null;
  devices: SpotifyDevice[];
  activeDeviceId: string | null;
  searchQuery: string;
  searchResults: SpotifySearchHit[];
  isConnecting: boolean;
  isSearching: boolean;
  isActing: boolean;
  actingAction: SpotifyPlaybackAction | null;
  isHydrating: boolean;
  error: string | null;
};

type SpotifySessionBucket = {
  listeners: Set<Listener>;
  state: SpotifySessionState;
  connectPollTimer: ReturnType<typeof setInterval> | null;
  playbackPollTimer: ReturnType<typeof setInterval> | null;
  connectPollGeneration: number;
  playbackPollGeneration: number;
  searchGeneration: number;
  wsBound: boolean;
};

const STORE_KEY = '__joySpotifySessionStore';
const CONNECT_POLL_MS = 2_000;
const PLAYBACK_POLL_MS = 4_000;
const ACTION_SYNC_DELAY_MS = 600;
function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}
const DISCONNECTED: SpotifyConnection = {
  provider: 'spotify',
  status: 'DISCONNECTED',
  connectedAt: null,
  scopes: [],
  displayName: null,
};

const EMPTY_PLAYBACK: SpotifyPlayback = {
  isPlaying: false,
  track: null,
  deviceId: null,
  deviceName: null,
};

function bucket(): SpotifySessionBucket {
  const globalRef = globalThis as typeof globalThis & {
    [STORE_KEY]?: SpotifySessionBucket;
  };
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = {
      listeners: new Set<Listener>(),
      state: {
        connection: null,
        playback: null,
        devices: [],
        activeDeviceId: null,
        searchQuery: '',
        searchResults: [],
        isConnecting: false,
        isSearching: false,
        isActing: false,
        actingAction: null,
        isHydrating: false,
        error: null,
      },
      connectPollTimer: null,
      playbackPollTimer: null,
      connectPollGeneration: 0,
      playbackPollGeneration: 0,
      searchGeneration: 0,
      wsBound: false,
    };
  }
  return globalRef[STORE_KEY];
}

function emit(): void {
  bucket().listeners.forEach((listener) => listener());
}

function setState(patch: Partial<SpotifySessionState>): void {
  const store = bucket();
  store.state = { ...store.state, ...patch };
  emit();
}

export function getSpotifySessionState(): SpotifySessionState {
  return bucket().state;
}

export function subscribeSpotifySession(listener: Listener): () => void {
  const store = bucket();
  store.listeners.add(listener);
  bindWebSocket();
  return () => {
    store.listeners.delete(listener);
  };
}

function stopConnectPolling(): void {
  const store = bucket();
  if (store.connectPollTimer) {
    clearInterval(store.connectPollTimer);
    store.connectPollTimer = null;
  }
}

function stopPlaybackPolling(): void {
  const store = bucket();
  if (store.playbackPollTimer) {
    clearInterval(store.playbackPollTimer);
    store.playbackPollTimer = null;
  }
}

async function pollConnectOnce(generation: number): Promise<void> {
  if (generation !== bucket().connectPollGeneration) {
    return;
  }
  const connection = await fetchSpotifyStatus();
  if (generation !== bucket().connectPollGeneration) {
    return;
  }
  setState({ connection, error: null });
  if (isSpotifyConnected(connection.status)) {
    stopConnectPolling();
    await refreshPluginCatalog().catch(() => undefined);
    await refreshSpotifyPlayer().catch(() => undefined);
  }
}

function startConnectPolling(): void {
  const store = bucket();
  stopConnectPolling();
  const generation = store.connectPollGeneration;
  store.connectPollTimer = setInterval(() => {
    void pollConnectOnce(generation).catch(() => undefined);
  }, CONNECT_POLL_MS);
}

function isRetryableConnectError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'SERVICE_UNAVAILABLE' || error.code === 'NETWORK_ERROR');
}

async function connectWithRetry(returnTo?: string): Promise<ConnectSpotifyResult> {
  const delaysMs = [0, 1_500, 3_000];
  let lastError: unknown;
  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await delay(delayMs);
    }
    try {
      return await connectSpotify(returnTo);
    } catch (error) {
      lastError = error;
      if (!isRetryableConnectError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}

export async function startSpotifyConnect(returnTo?: string): Promise<ConnectSpotifyResult> {
  const store = bucket();
  store.connectPollGeneration += 1;
  const generation = store.connectPollGeneration;
  setState({ isConnecting: true, error: null });
  try {
    const result = await connectWithRetry(returnTo);
    if (generation !== store.connectPollGeneration) {
      return result;
    }
    setState({ connection: result.connection });
    await pollConnectOnce(generation).catch(() => undefined);
    if (!isSpotifyConnected(result.connection.status)) {
      startConnectPolling();
    }
    return result;
  } catch (error) {
    if (generation === store.connectPollGeneration) {
      stopConnectPolling();
      setState({ isConnecting: false });
    }
    throw error;
  } finally {
    if (generation === store.connectPollGeneration) {
      setState({ isConnecting: false });
    }
  }
}

export function stopSpotifyConnectPolling(): void {
  bucket().connectPollGeneration += 1;
  stopConnectPolling();
}

export async function hydrateSpotifySession(): Promise<void> {
  setState({ isHydrating: true, error: null });
  try {
    const connection = await fetchSpotifyStatus();
    setState({ connection });
    if (isSpotifyConnected(connection.status)) {
      await refreshSpotifyPlayer();
    }
  } finally {
    setState({ isHydrating: false });
  }
}

export async function refreshSpotifyPlayer(): Promise<void> {
  const [playback, devices, active] = await Promise.all([
    fetchSpotifyPlayback().catch(() => EMPTY_PLAYBACK),
    fetchSpotifyDevices().catch(() => [] as SpotifyDevice[]),
    fetchSpotifyActiveDevice().catch(() => null),
  ]);
  setState({
    playback,
    devices,
    activeDeviceId: active?.id ?? playback.deviceId,
    error: null,
  });
}

export function startSpotifyPlaybackPolling(): void {
  const store = bucket();
  stopPlaybackPolling();
  store.playbackPollGeneration += 1;
  const generation = store.playbackPollGeneration;
  void refreshSpotifyPlayer().catch(() => undefined);
  store.playbackPollTimer = setInterval(() => {
    if (generation !== bucket().playbackPollGeneration) {
      return;
    }
    if (!isSpotifyConnected(bucket().state.connection?.status)) {
      return;
    }
    void refreshSpotifyPlayer().catch(() => undefined);
  }, PLAYBACK_POLL_MS);
}

export function stopSpotifyPlaybackPolling(): void {
  bucket().playbackPollGeneration += 1;
  stopPlaybackPolling();
}

export async function disconnectSpotifyIntegration(): Promise<void> {
  setCatalogMutating(true);
  try {
    stopSpotifyConnectPolling();
    stopSpotifyPlaybackPolling();
    await disconnectSpotifyRequest();
    setState({
      connection: DISCONNECTED,
      playback: EMPTY_PLAYBACK,
      devices: [],
      activeDeviceId: null,
      searchQuery: '',
      searchResults: [],
      actingAction: null,
      error: null,
    });
    markCatalogPluginDisconnected('spotify');
    await refreshPluginCatalog().catch(() => undefined);
  } finally {
    setCatalogMutating(false);
  }
}

export async function runSpotifySearch(query: string): Promise<void> {
  const store = bucket();
  const trimmed = query.trim();
  store.searchGeneration += 1;
  const generation = store.searchGeneration;
  setState({ searchQuery: query, isSearching: trimmed.length > 0 });
  if (!trimmed) {
    setState({ searchResults: [], isSearching: false });
    return;
  }
  try {
    const searchResults = await searchSpotifyTracks(trimmed);
    if (generation !== store.searchGeneration) {
      return;
    }
    setState({ searchResults, isSearching: false });
  } catch (error) {
    if (generation !== store.searchGeneration) {
      return;
    }
    setState({ isSearching: false });
    throw error;
  }
}

export async function runSpotifyAction(
  action: SpotifyPlaybackAction,
  options: { uri?: string; deviceId?: string } = {},
): Promise<void> {
  setState({ isActing: true, actingAction: action });
  try {
    const playback = await sendSpotifyAction(action, options);
    if (playback?.track) {
      setState({ playback });
    }
    await delay(ACTION_SYNC_DELAY_MS);
    await refreshSpotifyPlayer().catch(() => undefined);
  } finally {
    setState({ isActing: false, actingAction: null });
  }
}

export async function selectSpotifyDevice(deviceId: string): Promise<void> {
  setState({ isActing: true, activeDeviceId: deviceId });
  try {
    await setSpotifyPreferredDevice(deviceId);
    await refreshSpotifyPlayer();
  } finally {
    setState({ isActing: false });
  }
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (!isIntegrationStatusEvent(event) || event.integration !== 'spotify') {
    return;
  }
  const current = bucket().state.connection;
  setState({
    connection: {
      provider: 'spotify',
      status: event.status as SpotifyConnection['status'],
      connectedAt: current?.connectedAt ?? null,
      scopes: current?.scopes ?? [],
      displayName: current?.displayName ?? null,
    },
  });
  if (isSpotifyConnected(event.status)) {
    stopConnectPolling();
    void refreshPluginCatalog().catch(() => undefined);
    void refreshSpotifyPlayer().catch(() => undefined);
  }
}

function bindWebSocket(): void {
  const store = bucket();
  if (store.wsBound) {
    return;
  }
  store.wsBound = true;
  subscribeMobileWebSocket(handleRealtimeEvent);
}
