import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuthSession } from './auth-session-provider';

const PUBLIC_SEGMENTS: Record<string, true> = {
  splash: true,
  showcase: true,
  'plugin-detail': true,
  'whatsapp-connect': true,
  birthday: true,
};

export function AuthGate() {
  const { status, isAuthenticated } = useAuthSession();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const rootSegment = segments[0];

  useEffect(() => {
    if (!navigationState?.key || status !== 'ready') {
      return;
    }

    const isPublicPluginDetail = rootSegment === 'plugins' && segments.length > 1;
    if (rootSegment && (PUBLIC_SEGMENTS[rootSegment] || isPublicPluginDetail)) {
      return;
    }
    const inMain = rootSegment === '(main)' || rootSegment === 'chat' || rootSegment === 'plugins' || rootSegment === 'robot' || rootSegment === 'schedule';
    const inAuth = rootSegment === 'auth';
    const inWelcome = rootSegment == null;

    if (isAuthenticated && (inWelcome || inAuth)) {
      router.replace('/birthday' as unknown as Parameters<typeof router.replace>[0]);
      return;
    }

    if (!isAuthenticated && inMain) {
      router.replace('/');
    }
  }, [isAuthenticated, navigationState?.key, rootSegment, router, segments.length, status]);

  return null;
}
