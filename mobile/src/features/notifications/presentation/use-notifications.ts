import { useRouter, type Href } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import {
  addNotificationResponseReceivedListener,
} from '../data/notification-service';
import {
  getNotificationState,
  initializeNotifications,
  requestAndRegisterPushToken,
  subscribeNotificationStore,
  type NotificationState,
} from '../data/notification-store';

export function useNotifications(userId?: string): NotificationState & {
  requestPermissions: () => Promise<string | null>;
} {
  const router = useRouter();
  const state = useSyncExternalStore(
    subscribeNotificationStore,
    getNotificationState,
    getNotificationState,
  );

  useEffect(() => {
    void initializeNotifications();
  }, []);

  useEffect(() => {
    if (userId) {
      void requestAndRegisterPushToken(userId);
    }
  }, [userId]);

  useEffect(() => {
    const subscription = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (!data) return;

      const type = data.type;
      const sessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;

      if (type === 'schedule' || data.scheduleId) {
        if (sessionId) {
          router.push({ pathname: '/chat', params: { sessionId } } as Href);
        } else {
          router.push('/schedule' as Href);
        }
      } else if (type === 'whatsapp') {
        router.push('/plugins' as Href);
      } else if (sessionId) {
        router.push({ pathname: '/chat', params: { sessionId } } as Href);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return {
    ...state,
    requestPermissions: () => requestAndRegisterPushToken(userId),
  };
}
