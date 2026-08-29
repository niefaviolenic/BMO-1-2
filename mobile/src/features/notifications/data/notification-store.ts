import { Platform } from 'react-native';

import {
  subscribeMobileWebSocket,
  type MobileInboundEvent,
} from '@/lib/api';

import type {
  NotificationPermissionStatus,
} from '../domain/notification';
import {
  registerPushTokenApi,
  unregisterPushTokenApi,
} from './notification-api';
import {
  getExpoPushTokenAsync,
  getNotificationPermissionStatus,
  presentLocalNotification,
  requestNotificationPermissions,
  setupNotificationChannels,
} from './notification-service';

export type NotificationState = {
  pushToken: string | null;
  permissionStatus: NotificationPermissionStatus;
  isRegistering: boolean;
  error: string | null;
};

let state: NotificationState = {
  pushToken: null,
  permissionStatus: 'undetermined',
  isRegistering: false,
  error: null,
};

const listeners = new Set<(current: NotificationState) => void>();
let wsBound = false;

function emit(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function setState(patch: Partial<NotificationState>): void {
  state = { ...state, ...patch };
  emit();
}

export function getNotificationState(): NotificationState {
  return state;
}

export function subscribeNotificationStore(
  listener: (current: NotificationState) => void,
): () => void {
  listeners.add(listener);
  listener(state);
  bindWebSocket();
  return () => {
    listeners.delete(listener);
  };
}

export async function initializeNotifications(): Promise<void> {
  await setupNotificationChannels();
  let status = await getNotificationPermissionStatus();
  if (status === 'undetermined') {
    status = await requestNotificationPermissions();
  }
  setState({ permissionStatus: status });
  bindWebSocket();
}

export async function requestAndRegisterPushToken(userId?: string): Promise<string | null> {
  setState({ isRegistering: true, error: null });

  try {
    const status = await requestNotificationPermissions();
    setState({ permissionStatus: status });

    if (status !== 'granted') {
      setState({ isRegistering: false });
      return null;
    }

    const token = await getExpoPushTokenAsync();
    if (!token) {
      setState({ isRegistering: false });
      return null;
    }

    setState({ pushToken: token });

    if (userId) {
      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo';
      await registerPushTokenApi(token, platform);
    }

    setState({ isRegistering: false });
    return token;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to register push notifications';
    setState({ isRegistering: false, error: msg });
    return null;
  }
}

export async function unregisterCurrentPushToken(): Promise<void> {
  const currentToken = state.pushToken;
  if (!currentToken) return;

  try {
    await unregisterPushTokenApi(currentToken);
  } catch {
    // best-effort
  }

  setState({ pushToken: null });
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (!event || typeof event !== 'object') return;
  const raw = event as Record<string, unknown>;
  const eventName = typeof raw.event === 'string' ? raw.event : '';

  if (eventName === 'notification') {
    const title = typeof raw.title === 'string' ? raw.title : 'Joy Schedule';
    const body = typeof raw.body === 'string' ? raw.body : '';
    const id = typeof raw.id === 'string' ? raw.id : String(Date.now());
    const type = typeof raw.type === 'string' ? raw.type : 'generic';

    if (body) {
      void presentLocalNotification({
        title,
        body,
        data: { id, type, ...raw },
      });
    }
  } else if (eventName === 'schedule_status') {
    const title = typeof raw.title === 'string' ? raw.title : 'Joy Schedule Reminder';
    const body =
      typeof raw.body === 'string' && raw.body
        ? raw.body
        : typeof raw.prompt === 'string' && raw.prompt
          ? raw.prompt
          : typeof raw.message === 'string' && raw.message
            ? raw.message
            : typeof raw.statusLabel === 'string' && raw.statusLabel
              ? raw.statusLabel
              : 'Your scheduled reminder is ready';
    const scheduleId = typeof raw.scheduleId === 'string' ? raw.scheduleId : String(Date.now());

    void presentLocalNotification({
      title,
      body,
      data: { id: scheduleId, type: 'schedule', scheduleId, ...raw },
    });
  } else if (eventName === 'whatsapp_notification') {
    const displayName = typeof raw.displayName === 'string' ? raw.displayName : 'WhatsApp';
    const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId : '';
    void presentLocalNotification({
      title: 'WhatsApp Message',
      body: `Pesan baru dari ${displayName}`,
      data: { type: 'whatsapp', conversationId, ...raw },
    });
  }
}

function bindWebSocket(): void {
  if (wsBound) return;
  wsBound = true;
  subscribeMobileWebSocket(handleRealtimeEvent);
}
