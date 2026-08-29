import { API_ORIGIN } from './config';

export type MobileWebSocketAuth = {
  getAccessToken(): string | null;
  refreshAccessToken(): Promise<string | null>;
};

export type ChatThinkingEvent = {
  event: 'chat_thinking';
  sessionId: string;
  messageId: string;
};

export type ChatMessageEvent = {
  event: 'chat_message';
  sessionId: string;
  message: {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    sourceDeviceId?: string | null;
    createdAt: string;
  };
};
export type ChatTitleUpdatedEvent = {
  event: 'chat_title_updated';
  sessionId: string;
  title: string;
};


export type DeviceStatusEvent = {
  event: 'device_status';
  deviceId: string;
  online: boolean;
  lastSeenAt: string;
  wifi: {
    connected: boolean;
    rssi: number | null;
  };
  battery: {
    supported: boolean;
    percent: number | null;
  };
};

export type VoiceProcessingStatusEvent = {
  event: 'voice_processing_status';
  deviceId: string;
  requestId: string;
  status: 'thinking' | 'audio_ready' | 'completed' | 'failed';
  errorCode: string | null;
};

export type WifiConfigurationStatusEvent = {
  event: 'wifi_configuration_status';
  deviceId: string;
  configurationId: string;
  status: string;
  errorCode: string | null;
};

export type ProactiveDeliveryStatusEvent = {
  event: 'proactive_delivery_status';
  deviceId: string;
  deliveryId: string;
  source: string;
  status: string;
  errorCode: string | null;
};

export type ScheduleStatusEvent = {
  event: 'schedule_status';
  scheduleId: string;
  runId: string | null;
  status: string;
  statusLabel: string;
};

export type IntegrationStatusEvent = {
  event: 'integration_status';
  integration: 'whatsapp' | 'spotify';
  status: string;
};

export type NotificationEvent = {
  event: 'notification';
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
};

export type WhatsAppNotificationEvent = {
  event: 'whatsapp_notification';
  conversationId: string;
  displayName: string;
  conversationType: string;
  receivedAt: string;
};

export type MobileInboundEvent =
  | ChatThinkingEvent
  | ChatMessageEvent
  | ChatTitleUpdatedEvent
  | DeviceStatusEvent
  | VoiceProcessingStatusEvent
  | WifiConfigurationStatusEvent
  | ProactiveDeliveryStatusEvent
  | ScheduleStatusEvent
  | IntegrationStatusEvent
  | NotificationEvent
  | WhatsAppNotificationEvent
  | { event: string };

export function isDeviceStatusEvent(event: MobileInboundEvent): event is DeviceStatusEvent {
  return event.event === 'device_status';
}

export function isScheduleStatusEvent(event: MobileInboundEvent): event is ScheduleStatusEvent {
  return event.event === 'schedule_status';
}

export function isIntegrationStatusEvent(event: MobileInboundEvent): event is IntegrationStatusEvent {
  return event.event === 'integration_status';
}

export function isWhatsAppNotificationEvent(
  event: MobileInboundEvent,
): event is WhatsAppNotificationEvent {
  return event.event === 'whatsapp_notification';
}

type Listener = (event: MobileInboundEvent) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function unwrapEventRecord(event: MobileInboundEvent): Record<string, unknown> {
  const record = event as Record<string, unknown>;
  const nested = record.payload ?? record.data;
  if (isRecord(nested)) {
    return { ...record, ...nested };
  }

  return record;
}

export function normalizeMobileInboundEvent(
  event: MobileInboundEvent,
): ChatThinkingEvent | ChatMessageEvent | ChatTitleUpdatedEvent | null {
  const record = unwrapEventRecord(event);
  const eventName = readString(record, 'event');
  const sessionId = readString(record, 'sessionId', 'session_id');

  if (!eventName || !sessionId) {
    return null;
  }

  if (eventName === 'chat_thinking') {
    return {
      event: 'chat_thinking',
      sessionId,
      messageId: readString(record, 'messageId', 'message_id') ?? '',
    };
  }

  if (eventName === 'chat_title_updated') {
    const title = readString(record, 'title');
    if (!title) {
      return null;
    }
    return {
      event: 'chat_title_updated',
      sessionId,
      title,
    };
  }

  if (eventName !== 'chat_message') {
    return null;
  }

  const messageRecord = isRecord(record.message) ? record.message : record;
  const id = readString(messageRecord, 'id', 'messageId', 'message_id');
  const text = readString(messageRecord, 'text', 'content');

  if (!id || text == null) {
    return null;
  }

  const senderRaw = readString(messageRecord, 'sender', 'role');
  const sender: 'user' | 'assistant' =
    senderRaw?.toLowerCase() === 'user' ? 'user' : 'assistant';
  const sourceDeviceId =
    readString(
      messageRecord,
      'sourceDeviceId',
      'source_device_id',
      'deviceId',
      'device_id',
    ) ?? null;

  return {
    event: 'chat_message',
    sessionId,
    message: {
      id,
      sender,
      text,
      sourceDeviceId,
      createdAt: readString(messageRecord, 'createdAt', 'created_at') ?? '',
    },
  };
}

const ACCESS_TOKEN_EXPIRED_CODE = 4410;
const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 15_000;

let auth: MobileWebSocketAuth | null = null;
let socket: WebSocket | null = null;
let shouldStayConnected = false;
let retryMs = INITIAL_RETRY_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

function mobileWebSocketUrl(): string {
  const wsOrigin = API_ORIGIN.startsWith('https://')
    ? `wss://${API_ORIGIN.slice('https://'.length)}`
    : API_ORIGIN.startsWith('http://')
      ? `ws://${API_ORIGIN.slice('http://'.length)}`
      : API_ORIGIN;
  return `${wsOrigin}/api/v1/ws`;
}

function emit(event: MobileInboundEvent): void {
  listeners.forEach((listener) => listener(event));
}

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleReconnect(): void {
  if (!shouldStayConnected || retryTimer) {
    return;
  }

  const delay = retryMs;
  retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    openSocket();
  }, delay);
}

async function refreshToken(): Promise<string | null> {
  if (!auth) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = auth.refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

function authenticateSocket(target: WebSocket, accessToken: string): void {
  target.send(JSON.stringify({ event: 'authenticate', accessToken }));
}

function openSocket(): void {
  if (!shouldStayConnected || !auth) {
    return;
  }

  const accessToken = auth.getAccessToken();
  if (!accessToken) {
    scheduleReconnect();
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const next = new WebSocket(mobileWebSocketUrl());
  socket = next;

  next.onopen = () => {
    if (socket !== next) {
      return;
    }
    const token = auth?.getAccessToken();
    if (!token) {
      next.close();
      return;
    }
    authenticateSocket(next, token);
  };

  next.onmessage = (message) => {
    if (socket !== next) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(String(message.data));
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== 'object' || !('event' in parsed)) {
      return;
    }

    const event = parsed as MobileInboundEvent;
    if (event.event === 'authenticated') {
      retryMs = INITIAL_RETRY_MS;
      return;
    }

    emit(event);
  };

  next.onerror = () => {
    // Close handler drives reconnect.
  };

  next.onclose = (closeEvent) => {
    if (socket === next) {
      socket = null;
    }

    if (!shouldStayConnected) {
      return;
    }

    if (closeEvent.code === ACCESS_TOKEN_EXPIRED_CODE) {
      void refreshToken().then((token) => {
        if (!shouldStayConnected) {
          return;
        }
        if (token) {
          retryMs = INITIAL_RETRY_MS;
          openSocket();
          return;
        }
        scheduleReconnect();
      });
      return;
    }

    scheduleReconnect();
  };
}

export function configureMobileWebSocket(bridge: MobileWebSocketAuth | null): void {
  auth = bridge;
}

export function connectMobileWebSocket(): void {
  shouldStayConnected = true;
  retryMs = INITIAL_RETRY_MS;
  openSocket();
}

export function disconnectMobileWebSocket(): void {
  shouldStayConnected = false;
  clearRetry();
  const current = socket;
  socket = null;
  if (current) {
    current.onclose = null;
    current.onerror = null;
    current.onmessage = null;
    current.onopen = null;
    current.close();
  }
}

export function subscribeMobileWebSocket(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
