import * as WebBrowser from 'expo-web-browser';
import { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';
export type WelcomeActionsContainerProps = {
  onContinue?: () => void;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
};

export function WelcomeActionsContainer({
  onContinue,
  onTermsPress,
  onPrivacyPress,
}: WelcomeActionsContainerProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [scale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [scale]);

  const defaultTermsPress = useCallback(() => {
    if (onTermsPress) {
      onTermsPress();
    } else {
      void WebBrowser.openBrowserAsync('https://joy.ai/terms').catch(() => undefined);
    }
  }, [onTermsPress]);

  const defaultPrivacyPress = useCallback(() => {
    if (onPrivacyPress) {
      onPrivacyPress();
    } else {
      void WebBrowser.openBrowserAsync('https://joy.ai/privacy').catch(() => undefined);
    }
  }, [onPrivacyPress]);

  return (
    <View style={styles.container} testID="welcome-actions-container">
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
          testID="welcome-continue-button"
        >
          <Text style={[styles.buttonText, { color: theme.background }]}>Continue</Text>
        </Pressable>
      </Animated.View>

      <Text
        style={[styles.legalText, { color: theme.textMuted }]}
        testID="welcome-legal-text"
        accessible={true}
      >
        By continuing, you agree to our{' '}
        <Text
          style={[styles.legalLink, { color: theme.text }]}
          onPress={defaultTermsPress}
          accessibilityRole="link"
          testID="welcome-terms-link"
        >
          Terms of Service
        </Text>{' '}
        and acknowledge our{' '}
        <Text
          style={[styles.legalLink, { color: theme.text }]}
          onPress={defaultPrivacyPress}
          accessibilityRole="link"
          testID="welcome-privacy-link"
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: WelcomeTokens.spacing.actionsGap,
    alignSelf: 'stretch',
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
    opacity: 0.9,
  },
  buttonText: {
    color: WelcomeTokens.colors.buttonText,
    fontSize: WelcomeTokens.typography.buttonText.fontSize,
    fontWeight: WelcomeTokens.typography.buttonText.fontWeight,
    lineHeight: WelcomeTokens.typography.buttonText.lineHeight,
  },
  legalText: {
    color: WelcomeTokens.colors.textLegal,
    fontSize: WelcomeTokens.typography.legalText.fontSize,
    fontWeight: WelcomeTokens.typography.legalText.fontWeight,
    lineHeight: WelcomeTokens.typography.legalText.lineHeight,
    textAlign: 'center',
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: WelcomeTokens.colors.textLegal,
  },
});
