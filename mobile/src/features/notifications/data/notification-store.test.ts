/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

import type { MobileInboundEvent, NotificationEvent } from '@/lib/api';

import {
  getNotificationState,
  initializeNotifications,
  requestAndRegisterPushToken,
  unregisterCurrentPushToken,
} from './notification-store';
import * as NotificationService from './notification-service';
import * as NotificationApi from './notification-api';

let mockWsCallback: ((event: MobileInboundEvent) => void) | null = null;

vi.mock('@/lib/api', () => ({
  subscribeMobileWebSocket: (cb: (event: MobileInboundEvent) => void) => {
    mockWsCallback = cb;
    return () => {
      mockWsCallback = null;
    };
  },
}));

vi.mock('./notification-service', () => ({
  setupNotificationChannels: vi.fn().mockResolvedValue(undefined),
  getNotificationPermissionStatus: vi.fn().mockResolvedValue('granted'),
  requestNotificationPermissions: vi.fn().mockResolvedValue('granted'),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue('ExponentPushToken[mock-token-123]'),
  presentLocalNotification: vi.fn().mockResolvedValue('local-notif-1'),
}));

vi.mock('./notification-api', () => ({
  registerPushTokenApi: vi.fn().mockResolvedValue({ id: '1', token: 'ExponentPushToken[mock-token-123]' }),
  unregisterPushTokenApi: vi.fn().mockResolvedValue(true),
  listPushTokensApi: vi.fn().mockResolvedValue([]),
}));

describe('NotificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes notification channels and permission status', async () => {
    await initializeNotifications();
    expect(NotificationService.setupNotificationChannels).toHaveBeenCalled();
    const state = getNotificationState();
    expect(state.permissionStatus).toBe('granted');
  });

  it('requests and registers push token with backend API', async () => {
    const token = await requestAndRegisterPushToken('user-123');
    expect(token).toBe('ExponentPushToken[mock-token-123]');
    expect(NotificationApi.registerPushTokenApi).toHaveBeenCalledWith(
      'ExponentPushToken[mock-token-123]',
      expect.any(String),
    );
    const state = getNotificationState();
    expect(state.pushToken).toBe('ExponentPushToken[mock-token-123]');
  });

  it('unregisters push token on logout', async () => {
    await unregisterCurrentPushToken();
    expect(NotificationApi.unregisterPushTokenApi).toHaveBeenCalledWith('ExponentPushToken[mock-token-123]');
    const state = getNotificationState();
    expect(state.pushToken).toBeNull();
  });

  it('presents local notification when websocket notification event arrives', () => {
    expect(mockWsCallback).not.toBeNull();
    const event: NotificationEvent = {
      event: 'notification',
      id: 'msg-123',
      type: 'GENERIC',
      title: 'Joy Schedule',
      body: 'Waktunya minum air!',
      createdAt: '2026-08-27T10:00:00.000Z',
    };
    mockWsCallback?.(event);

    expect(NotificationService.presentLocalNotification).toHaveBeenCalledWith({
      title: 'Joy Schedule',
      body: 'Waktunya minum air!',
      data: expect.objectContaining({
        id: 'msg-123',
        event: 'notification',
      }),
    });
  });

  it('presents local notification when whatsapp_notification event arrives', () => {
    expect(mockWsCallback).not.toBeNull();
    const event: MobileInboundEvent = {
      event: 'whatsapp_notification',
      conversationId: 'conv-456',
      displayName: 'Budi',
      conversationType: 'individual',
      receivedAt: '2026-08-27T10:00:00.000Z',
    };
    mockWsCallback?.(event);

    expect(NotificationService.presentLocalNotification).toHaveBeenCalledWith({
      title: 'WhatsApp Message',
      body: 'Pesan baru dari Budi',
      data: expect.objectContaining({
        type: 'whatsapp',
        conversationId: 'conv-456',
        displayName: 'Budi',
      }),
    });
  });

  it('presents local notification when schedule_status event arrives', () => {
    expect(mockWsCallback).not.toBeNull();
    const event: MobileInboundEvent = {
      event: 'schedule_status',
      scheduleId: 'sched-789',
      runId: 'run-1',
      status: 'due',
      statusLabel: 'Waktunya minum obat',
    };
    mockWsCallback?.(event);

    expect(NotificationService.presentLocalNotification).toHaveBeenCalledWith({
      title: 'Joy Schedule Reminder',
      body: 'Waktunya minum obat',
      data: expect.objectContaining({
        id: 'sched-789',
        type: 'schedule',
        scheduleId: 'sched-789',
      }),
    });
  });

  it('requests permission on initialize if permission status is undetermined', async () => {
    vi.mocked(NotificationService.getNotificationPermissionStatus).mockResolvedValueOnce('undetermined');
    vi.mocked(NotificationService.requestNotificationPermissions).mockResolvedValueOnce('granted');

    await initializeNotifications();

    expect(NotificationService.requestNotificationPermissions).toHaveBeenCalled();
    const state = getNotificationState();
    expect(state.permissionStatus).toBe('granted');
  });
});
