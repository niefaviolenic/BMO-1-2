/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockExpoNotifications } = vi.hoisted(() => {
  const mock = {
    setNotificationHandler: vi.fn(),
    setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
    getPermissionsAsync: vi.fn().mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
      expires: 'never',
    }),
    requestPermissionsAsync: vi.fn().mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
      expires: 'never',
    }),
    getExpoPushTokenAsync: vi.fn().mockResolvedValue({
      data: 'ExponentPushToken[mock-token-abc]',
    }),
    scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id-123'),
    addNotificationReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    addNotificationResponseReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    AndroidImportance: {
      MAX: 5,
      HIGH: 4,
      DEFAULT: 3,
    },
    AndroidNotificationVisibility: {
      PUBLIC: 1,
    },
    IosAuthorizationStatus: {
      AUTHORIZED: 2,
      PROVISIONAL: 3,
    },
  };
  return { mockExpoNotifications: mock };
});

vi.mock('expo-notifications', () => mockExpoNotifications);
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'eas-project-id-123',
        },
      },
    },
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  _resetNotificationServiceForTesting,
  getExpoNotifications,
  getExpoPushTokenAsync,
  getNotificationPermissionStatus,
  presentLocalNotification,
  requestNotificationPermissions,
  setupNotificationChannels,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from './notification-service';
describe('NotificationService', () => {
  beforeEach(() => {
    _resetNotificationServiceForTesting();
    // @ts-ignore
    Platform.OS = 'android';
    vi.clearAllMocks();
  });

  it('loads expo-notifications and configures notification handler', () => {
    const notifs = getExpoNotifications();
    expect(notifs).toBeDefined();
    expect(mockExpoNotifications.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        handleNotification: expect.any(Function),
      }),
    );
  });

  it('sets up Android notification channels with MAX importance for schedules', async () => {
    await setupNotificationChannels();
    expect(mockExpoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'joy-schedules',
      expect.objectContaining({
        name: 'Joy Schedules & Reminders',
        importance: 5,
      }),
    );
    expect(mockExpoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        name: 'Joy General Notifications',
        importance: 4,
      }),
    );
  });

  it('gets notification permission status accurately', async () => {
    const status = await getNotificationPermissionStatus();
    expect(status).toBe('granted');
    expect(mockExpoNotifications.getPermissionsAsync).toHaveBeenCalled();
  });

  it('requests notification permissions when needed', async () => {
    mockExpoNotifications.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
      expires: 'never',
    });

    const status = await requestNotificationPermissions();
    expect(status).toBe('granted');
    expect(mockExpoNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('retrieves Expo push token with projectId from Constants in standalone/dev build', async () => {
    const token = await getExpoPushTokenAsync();
    expect(token).toBe('ExponentPushToken[mock-token-abc]');
    expect(mockExpoNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'eas-project-id-123',
    });
  });

  it('gracefully skips push token retrieval in Expo Go (appOwnership expo or storeClient)', async () => {
    // @ts-ignore
    Constants.appOwnership = 'expo';

    let token = await getExpoPushTokenAsync();
    expect(token).toBeNull();

    // @ts-ignore
    Constants.appOwnership = undefined;
    // @ts-ignore
    Constants.executionEnvironment = 'storeClient';

    token = await getExpoPushTokenAsync();
    expect(token).toBeNull();

    // @ts-ignore
    Constants.executionEnvironment = undefined;
  });

  it('gracefully skips push token retrieval on iOS platform', async () => {
    // @ts-ignore
    Platform.OS = 'ios';

    const token = await getExpoPushTokenAsync();
    expect(token).toBeNull();
    expect(mockExpoNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('presents local notification using scheduleNotificationAsync with correct channelId', async () => {
    const result = await presentLocalNotification({
      title: 'Minum Air',
      body: 'Waktunya minum segelas air',
      data: { scheduleId: 'sched-1' },
    });

    expect(result).toBe('notif-id-123');
    expect(mockExpoNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Minum Air',
        body: 'Waktunya minum segelas air',
        data: { scheduleId: 'sched-1' },
        sound: 'default',
        channelId: 'joy-schedules',
      },
      trigger: null,
    });
  });

  it('adds notification received and response listeners', () => {
    const receivedListener = vi.fn();
    const responseListener = vi.fn();

    const sub1 = addNotificationReceivedListener(receivedListener);
    const sub2 = addNotificationResponseReceivedListener(responseListener);

    expect(mockExpoNotifications.addNotificationReceivedListener).toHaveBeenCalledWith(receivedListener);
    expect(mockExpoNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(responseListener);
    expect(sub1.remove).toBeDefined();
    expect(sub2.remove).toBeDefined();
  });
});
