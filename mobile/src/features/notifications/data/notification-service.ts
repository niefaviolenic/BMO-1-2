import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse, Subscription } from 'expo-notifications';
import { Platform } from 'react-native';

import {
  NOTIFICATION_CHANNELS,
  type LocalNotificationInput,
  type NotificationPermissionStatus,
} from '../domain/notification';

let handlerInitialized = false;
let channelsInitialized = false;

export function _resetNotificationServiceForTesting(): void {
  handlerInitialized = false;
  channelsInitialized = false;
}

export function getExpoNotifications(): typeof Notifications | null {
  if (!handlerInitialized) {
    handlerInitialized = true;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // Ignored if handler is unsupported
    }
  }

  return Notifications;
}
export async function setupNotificationChannels(): Promise<void> {
  if (channelsInitialized || Platform.OS !== 'android') {
    return;
  }

  const notifications = getExpoNotifications();
  if (!notifications) {
    return;
  }

  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient';

  if (isExpoGo) {
    channelsInitialized = true;
    return;
  }

  try {
    await notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.SCHEDULES, {
      name: 'Joy Schedules & Reminders',
      description: 'Notifications for your upcoming and due schedules',
      importance: notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DEFAULT, {
      name: 'Joy General Notifications',
      description: 'General updates and messages from Joy',
      importance: notifications.AndroidImportance.HIGH,
    });

    channelsInitialized = true;
  } catch (error) {
    console.warn('[Notifications] Failed to setup notification channels:', error);
  }
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const notifications = getExpoNotifications();
  if (!notifications) {
    return 'undetermined';
  }

  try {
    const settings = await notifications.getPermissionsAsync();
    if (
      settings.granted ||
      settings.ios?.status === notifications.IosAuthorizationStatus.AUTHORIZED ||
      settings.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return 'granted';
    }
    if (settings.canAskAgain) {
      return 'undetermined';
    }
    return 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  const notifications = getExpoNotifications();
  if (!notifications) {
    return 'denied';
  }

  try {
    await setupNotificationChannels();
    const existing = await notifications.getPermissionsAsync();
    if (
      existing.granted ||
      existing.ios?.status === notifications.IosAuthorizationStatus.AUTHORIZED ||
      existing.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return 'granted';
    }

    const requested = await notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (
      requested.granted ||
      requested.ios?.status === notifications.IosAuthorizationStatus.AUTHORIZED ||
      requested.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return 'granted';
    }
    return 'denied';
  } catch (error) {
    console.warn('[Notifications] Permission request error:', error);
    return 'denied';
  }
}

export async function getExpoPushTokenAsync(): Promise<string | null> {
  const notifications = getExpoNotifications();
  if (!notifications) {
    return null;
  }

  try {
    await setupNotificationChannels();
    const permission = await requestNotificationPermissions();
    if (permission !== 'granted') {
      return null;
    }

    const isExpoGo =
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === 'storeClient';

    if (Platform.OS === 'ios' || isExpoGo) {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data ?? null;
  } catch (error) {
    console.warn('[Notifications] Failed to get push token:', error);
    return null;
  }
}

export async function presentLocalNotification(input: LocalNotificationInput): Promise<string | null> {
  const notifications = getExpoNotifications();
  if (!notifications) {
    return null;
  }

  try {
    await setupNotificationChannels();
    const channelId = input.channelId ?? NOTIFICATION_CHANNELS.SCHEDULES;

    return await notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        sound: input.sound !== false ? 'default' : undefined,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[Notifications] Failed to present local notification:', error);
    return null;
  }
}

export function addNotificationReceivedListener(
  listener: (notification: Notification) => void,
): Subscription | { remove: () => void } {
  const notifications = getExpoNotifications();
  if (!notifications) {
    return { remove: () => {} };
  }

  try {
    return notifications.addNotificationReceivedListener(listener);
  } catch {
    return { remove: () => {} };
  }
}

export function addNotificationResponseReceivedListener(
  listener: (response: NotificationResponse) => void,
): Subscription | { remove: () => void } {
  const notifications = getExpoNotifications();
  if (!notifications) {
    return { remove: () => {} };
  }

  try {
    return notifications.addNotificationResponseReceivedListener(listener);
  } catch {
    return { remove: () => {} };
  }
}
