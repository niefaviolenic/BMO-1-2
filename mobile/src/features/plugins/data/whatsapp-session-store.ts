import {
  isApiError,
  isIntegrationStatusEvent,
  isWhatsAppNotificationEvent,
  subscribeMobileWebSocket,
  type MobileInboundEvent,
} from '@/lib/api';

import { isWhatsAppConnected, secondsUntilExpiry } from '../domain/whatsapp';
import type {
  WhatsAppConnection,
  WhatsAppConversation,
  WhatsAppPairing,
  WhatsAppQr,
  WhatsAppRule,
  WhatsAppRulePatch,
} from '../domain/whatsapp';

import {
  markCatalogPluginDisconnected,
  refreshPluginCatalog,
  setCatalogMutating,
} from './plugin-catalog-store';
import {
  confirmWhatsAppScanned,
  connectWhatsApp,
  type ConnectWhatsAppResult,
  disconnectWhatsApp as disconnectWhatsAppRequest,
  dismissWhatsAppQr,
  fetchWhatsAppConversations,
  fetchWhatsAppQr,
  fetchWhatsAppRules,
  fetchWhatsAppStatus,
  resolveWhatsAppConversation,
  updateWhatsAppRules,
} from './whatsapp-api';

type Listener = () => void;

export type WhatsAppSessionState = {
  connection: WhatsAppConnection | null;
  pairing: WhatsAppPairing | null;
  qr: WhatsAppQr | null;
  rules: WhatsAppRule[];
  conversations: WhatsAppConversation[];
  isConnecting: boolean;
  isLoadingRules: boolean;
  error: string | null;
};

type WhatsAppSessionBucket = {
  listeners: Set<Listener>;
  state: WhatsAppSessionState;
  pollTimer: ReturnType<typeof setInterval> | null;
  pollGeneration: number;
  wsBound: boolean;
};

const STORE_KEY = '__joyWhatsAppSessionStore';
const POLL_INTERVAL_MS = 2_000;

const DISCONNECTED: WhatsAppConnection = {
  provider: 'whatsapp',
  status: 'DISCONNECTED',
  connectedAt: null,
  scopes: [],
};

function bucket(): WhatsAppSessionBucket {
  const globalRef = globalThis as typeof globalThis & {
    [STORE_KEY]?: WhatsAppSessionBucket;
  };
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = {
      listeners: new Set<Listener>(),
      state: {
        connection: null,
        pairing: null,
        qr: null,
        rules: [],
        conversations: [],
        isConnecting: false,
        isLoadingRules: false,
        error: null,
      },
      pollTimer: null,
      pollGeneration: 0,
      wsBound: false,
    };
  }
  return globalRef[STORE_KEY];
}

function emit(): void {
  bucket().listeners.forEach((listener) => listener());
}

function setState(patch: Partial<WhatsAppSessionState>): void {
  const store = bucket();
  store.state = { ...store.state, ...patch };
  emit();
}

export function getWhatsAppSessionState(): WhatsAppSessionState {
  return bucket().state;
}

export function subscribeWhatsAppSession(listener: Listener): () => void {
  const store = bucket();
  store.listeners.add(listener);
  bindWebSocket();
  return () => {
    store.listeners.delete(listener);
  };
}

function stopPolling(): void {
  const store = bucket();
  if (store.pollTimer) {
    clearInterval(store.pollTimer);
    store.pollTimer = null;
  }
}



export async function dismissWhatsAppSessionQr(): Promise<void> {
  stopPolling();
  await dismissWhatsAppQr().catch(() => undefined);
}

async function pollOnce(generation: number): Promise<void> {
  const store = bucket();
  if (generation !== store.pollGeneration) {
    return;
  }

  const currentQr = store.state.qr;
  const isCurrentQrActive =
    Boolean(currentQr?.qr) &&
    (currentQr?.expiresAt ? (secondsUntilExpiry(currentQr.expiresAt) ?? 0) : 0) > 0;

  // State 1 Only:
  // When a valid active fresh QR is already in store, only poll connection status.
  // This prevents silently overwriting the fresh QR with noisy/stale background rotations.
  let connection: WhatsAppConnection;
  let qr: WhatsAppQr | null = currentQr;

  if (isCurrentQrActive) {
    connection = await fetchWhatsAppStatus();
  } else if (!currentQr?.qr) {
    const [fetchedConnection, fetchedQr] = await Promise.all([
      fetchWhatsAppStatus(),
      fetchWhatsAppQr(),
    ]);
    connection = fetchedConnection;
    qr = fetchedQr.qr ? fetchedQr : null;
  } else {
    // Current QR expired; stop polling so the expired state stays frozen until user taps Reload.
    stopPolling();
    return;
  }

  if (generation !== store.pollGeneration) {
    return;
  }

  setState({ connection, ...(qr ? { qr } : {}), error: null });

  if (isWhatsAppConnected(connection.status)) {
    stopPolling();
    await refreshPluginCatalog().catch(() => undefined);
  }
}

function startPolling(): void {
  const store = bucket();
  stopPolling();
  const generation = store.pollGeneration;
  store.pollTimer = setInterval(() => {
    void pollOnce(generation).catch(() => undefined);
  }, POLL_INTERVAL_MS);
}

function isRetryableWhatsAppConnectError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'SERVICE_UNAVAILABLE' || error.code === 'NETWORK_ERROR');
}
function sleepMs(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

async function connectWhatsAppWithRetry(phoneNumber?: string): Promise<ConnectWhatsAppResult> {
  const delaysMs = [0, 1_500, 3_000];
  let lastError: unknown;
  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await sleepMs(delayMs);
    }
    try {
      return await connectWhatsApp(phoneNumber);
    } catch (error) {
      lastError = error;
      if (!isRetryableWhatsAppConnectError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}

export async function startWhatsAppConnect(
  phoneNumber?: string,
  options?: { forceReset?: boolean },
): Promise<ConnectWhatsAppResult> {
  const store = bucket();
  store.pollGeneration += 1;
  const generation = store.pollGeneration;
  stopPolling();
  setState({ isConnecting: true, qr: null, error: null });

  if (options?.forceReset) {
    await disconnectWhatsAppRequest().catch(() => undefined);
    await sleepMs(300);
  }

  try {
    const result = await connectWhatsAppWithRetry(phoneNumber);
    if (generation === store.pollGeneration) {
      setState({ connection: result.connection, pairing: result.pairing });
      await pollOnce(generation).catch(() => undefined);
      if (!isWhatsAppConnected(result.connection.status)) {
        startPolling();
      }
    }
    return result;
  } catch (error) {
    if (generation === store.pollGeneration) {
      stopPolling();
      setState({ isConnecting: false });
    }
    throw error;
  } finally {
    if (generation === store.pollGeneration) {
      setState({ isConnecting: false });
    }
  }
}

export function stopWhatsAppConnectPolling(): void {
  bucket().pollGeneration += 1;
  stopPolling();
}

export async function hydrateWhatsAppSession(): Promise<void> {
  const connection = await fetchWhatsAppStatus();
  setState({ connection, error: null });
}

export async function confirmWhatsAppPairing(): Promise<WhatsAppConnection> {
  try {
    const connection = await confirmWhatsAppScanned();
    setState({ connection, error: null });
    if (isWhatsAppConnected(connection.status)) {
      stopPolling();
      await refreshPluginCatalog().catch(() => undefined);
    }
    return connection;
  } catch (error) {
    if (isApiError(error) && error.status === 409) {
      const connection = await fetchWhatsAppStatus();
      setState({ connection });
      if (isWhatsAppConnected(connection.status)) {
        stopPolling();
        await refreshPluginCatalog().catch(() => undefined);
        return connection;
      }
    }
    throw error;
  }
}

export async function disconnectWhatsAppIntegration(): Promise<void> {
  setCatalogMutating(true);
  try {
    stopWhatsAppConnectPolling();
    await disconnectWhatsAppRequest();
    setState({
      connection: DISCONNECTED,
      pairing: null,
      qr: null,
      rules: [],
      conversations: [],
      error: null,
    });
    markCatalogPluginDisconnected('whatsapp');
    await refreshPluginCatalog().catch(() => undefined);
  } finally {
    setCatalogMutating(false);
  }
}

export async function refreshWhatsAppRules(): Promise<void> {
  setState({ isLoadingRules: true });
  try {
    const [rules, conversations, connection] = await Promise.all([
      fetchWhatsAppRules(),
      fetchWhatsAppConversations(),
      fetchWhatsAppStatus().catch(() => null),
    ]);
    setState({
      rules,
      conversations,
      ...(connection ? { connection } : {}),
      isLoadingRules: false,
    });
  } catch (error) {
    setState({ isLoadingRules: false });
    throw error;
  }
}

export async function saveWhatsAppRules(rules: WhatsAppRulePatch[]): Promise<void> {
  const next = await updateWhatsAppRules(rules);
  setState({ rules: next });
}

export async function addWhatsAppContact(
  phoneNumber: string,
  displayName?: string,
): Promise<WhatsAppConversation> {
  const conversation = await resolveWhatsAppConversation(phoneNumber, displayName);
  const conversations = bucket().state.conversations;
  const without = conversations.filter((item) => item.id !== conversation.id);
  setState({ conversations: [conversation, ...without] });
  return conversation;
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (isIntegrationStatusEvent(event) && event.integration === 'whatsapp') {
    const current = bucket().state.connection;
    setState({
      connection: {
        provider: 'whatsapp',
        status: event.status as WhatsAppConnection['status'],
        connectedAt: current?.connectedAt ?? null,
        scopes: current?.scopes ?? [],
      },
    });
    if (isWhatsAppConnected(event.status)) {
      stopPolling();
      void refreshPluginCatalog().catch(() => undefined);
    }
    return;
  }

  if (isWhatsAppNotificationEvent(event)) {
    void fetchWhatsAppConversations()
      .then((conversations) => setState({ conversations }))
      .catch(() => undefined);
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
