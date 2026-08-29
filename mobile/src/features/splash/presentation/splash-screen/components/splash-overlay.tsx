import * as SplashScreenApi from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SplashTokens } from '@/constants/theme';
import { SplashScreen } from '@/features/splash/presentation/splash-screen/splash-screen';
export type SplashOverlayProps = {
  onComplete?: () => void;
};

let hasCompletedInitialSplash = false;

export function SplashOverlay({ onComplete }: SplashOverlayProps) {
  const [visible, setVisible] = useState(!hasCompletedInitialSplash);
  const opacity = useRef(new Animated.Value(hasCompletedInitialSplash ? 0 : 1)).current;
  const completed = useRef(hasCompletedInitialSplash);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    hasCompletedInitialSplash = true;
    setVisible(false);
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    void SplashScreenApi.hideAsync().catch(() => undefined);

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        duration: SplashTokens.motion.fadeDuration,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        finish();
      });
      setTimeout(finish, SplashTokens.motion.fadeDuration + 100);
    }, SplashTokens.motion.minimumVisibleDuration);

    return () => {
      clearTimeout(timer);
    };
  }, [finish, opacity]);

  const colorScheme = useColorScheme();

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <SplashScreen />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1_000,
  },
});
