export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type PushTokenRecord = {
  id?: string;
  token: string;
  platform: 'android' | 'ios' | 'web' | 'expo';
  deviceId?: string | null;
  createdAt?: string;
};

export type NotificationType = 'schedule' | 'generic' | 'whatsapp' | 'system';

export type JoyNotificationPayload = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt?: string;
};

export type LocalNotificationInput = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: boolean | string;
};

export const NOTIFICATION_CHANNELS = {
  SCHEDULES: 'joy-schedules',
  DEFAULT: 'default',
} as const;
