import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';
import { BirthdayTypingHeader } from '../components/birthday-typing-header';
import { ConfettiCannon } from '../components/confetti-cannon';

export type BirthdayScreenProps = {
  onContinue?: () => void;
  testID?: string;
};

export function BirthdayScreen({
  onContinue,
  testID = 'birthday-screen',
}: BirthdayScreenProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 35,
      bounciness: 0,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  }, [scale]);

  const paddingBottom = Math.max(insets.bottom + 16, 34);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]} testID={testID}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ConfettiCannon testID={`${testID}-confetti`} />

      {/* Centered typing header */}
      <View style={styles.centerContainer} testID={`${testID}-center-container`}>
        <BirthdayTypingHeader testID={`${testID}-typing-header`} />
      </View>

      {/* Bottom action button */}
      <View style={[styles.bottomContainer, { paddingBottom }]} testID={`${testID}-actions`}>
        <Animated.View style={[{ transform: [{ scale }] }, styles.buttonWrapper]}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.buttonPressed,
            ]}
            onPress={onContinue}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            testID={`${testID}-continue-button`}
          >
            <Text style={[styles.buttonText, { color: theme.background }]}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WelcomeTokens.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bottomContainer: {
    width: '100%',
    paddingHorizontal: WelcomeTokens.spacing.horizontalPadding,
  },
  buttonWrapper: {
    alignSelf: 'stretch',
  },
  button: {
    height: WelcomeTokens.spacing.buttonHeight,
    backgroundColor: WelcomeTokens.colors.buttonBackground,
    borderRadius: WelcomeTokens.spacing.buttonRadius,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: WelcomeTokens.colors.buttonText,
    fontSize: WelcomeTokens.typography.buttonText.fontSize,
    fontWeight: WelcomeTokens.typography.buttonText.fontWeight,
    lineHeight: WelcomeTokens.typography.buttonText.lineHeight,
  },
});
