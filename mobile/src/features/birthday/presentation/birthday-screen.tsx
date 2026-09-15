import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';
import { BirthdayContent } from '../components/birthday-content';
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

  const paddingTop = Math.max(insets.top + 32, 64);
  const paddingBottom = Math.max(insets.bottom + 16, 34);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]} testID={testID}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ConfettiCannon testID={`${testID}-confetti`} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop,
            paddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainLayout}>
          <BirthdayContent testID={`${testID}-content`} />

          <View style={styles.actionsContainer} testID={`${testID}-actions`}>
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

            <Text style={[styles.footnote, { color: theme.textMuted }]} testID={`${testID}-footnote`}>
              Made with love for Devira 💕
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WelcomeTokens.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: WelcomeTokens.spacing.horizontalPadding,
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionsContainer: {
    gap: 16,
    alignSelf: 'stretch',
    marginTop: 32,
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
  footnote: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
