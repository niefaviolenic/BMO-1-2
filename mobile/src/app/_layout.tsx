import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox } from 'react-native';

LogBox.ignoreAllLogs(true);

import { AuthGate } from '@/features/auth/presentation/auth-gate';
import { AuthSessionProvider, useAuthSession } from '@/features/auth/presentation/auth-session-provider';
import { SplashOverlay } from '@/features/splash/presentation/splash-screen/components/splash-overlay';
import { useNotifications } from '@/features/notifications';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { hydrateAppearancePreference } from '@/features/settings/data/appearance-store';

WebBrowser.maybeCompleteAuthSession();
function NotificationLifecycle() {
  const { user } = useAuthSession();
  useNotifications(user?.id);
  return null;
}
function RootSplashOverlay() {
  const { status } = useAuthSession();
  return <SplashOverlay isReady={status === 'ready'} />;
}


export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const isSplashPreview = segments[0] === 'splash' || segments[0] === 'showcase';

  useEffect(() => {
    void hydrateAppearancePreference();
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colorScheme === 'dark' ? '#000000' : '#FFFFFF');
  }, [colorScheme]);

  const bg = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AuthSessionProvider>
          <AuthGate />
          <NotificationLifecycle />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" options={{ animation: 'fade' }} />
            <Stack.Screen name="(main)" />
            <Stack.Screen name="splash" />
            <Stack.Screen
              name="plugin-detail"
              options={{
                presentation: 'transparentModal',
                animation: 'none',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="plugins/[id]"
              options={{
                presentation: 'transparentModal',
                animation: 'none',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen name="whatsapp-connect" />
            <Stack.Screen name="birthday" options={{ animation: 'fade' }} />
            <Stack.Screen name="showcase" />
          </Stack>
          {isSplashPreview ? null : <RootSplashOverlay />}
        </AuthSessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
