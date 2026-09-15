import * as SplashScreenApi from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SplashTokens } from '@/constants/theme';
import { SplashScreen } from '@/features/splash/presentation/splash-screen/splash-screen';
export type SplashOverlayProps = {
  onComplete?: () => void;
  isReady?: boolean;
};

let hasCompletedInitialSplash = false;

export function SplashOverlay({ onComplete, isReady = true }: SplashOverlayProps) {
  const [visible, setVisible] = useState(!hasCompletedInitialSplash);
  const [minDurationPassed, setMinDurationPassed] = useState(false);
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
      setMinDurationPassed(true);
    }, SplashTokens.motion.minimumVisibleDuration);

    // Safety fallback: ensure splash never stays stuck longer than 3 seconds
    const safetyTimer = setTimeout(() => {
      setMinDurationPassed(true);
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (!visible || completed.current || !minDurationPassed || !isReady) {
      return;
    }

    Animated.timing(opacity, {
      duration: SplashTokens.motion.fadeDuration,
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      finish();
    });

    const fallback = setTimeout(finish, SplashTokens.motion.fadeDuration + 100);
    return () => {
      clearTimeout(fallback);
    };
  }, [finish, isReady, minDurationPassed, opacity, visible]);

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
