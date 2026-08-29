import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type AuthBottomSheetProps = {
  onApplePress?: () => void;
  onGooglePress?: () => void;
  onLoginPress?: () => void;
  delayMs?: number;
  showApple?: boolean;
};

export function AuthBottomSheet({
  onApplePress,
  onGooglePress,
  onLoginPress,
  delayMs = 0,
  showApple = false,
}: AuthBottomSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const authColors = isDark ? AuthTokens.colors.dark : AuthTokens.colors.light;
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (delayMs > 0) {
      translateY.setValue(400);
      const timer = setTimeout(() => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 55,
          friction: 11,
        }).start();
      }, delayMs);

      return () => clearTimeout(timer);
    }
  }, [delayMs, translateY]);

  const paddingBottom = Math.max(insets.bottom + 20, AuthTokens.spacing.sheetPaddingBottom);

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: authColors.sheetBackground,
          paddingBottom,
          transform: [{ translateY }],
        },
      ]}
      testID="auth-bottom-sheet"
    >
      {showApple ? (
        <Pressable
          style={({ pressed }) => [
            styles.appleButton,
            { backgroundColor: authColors.appleButtonBackground },
            pressed && styles.buttonPressed,
          ]}
          onPress={onApplePress}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          testID="auth-apple-button"
        >
          <Image
            source={require('@/assets/images/auth/apple-logo.svg')}
            style={styles.appleLogo}
            contentFit="contain"
          />
          <Text style={[styles.buttonText, { color: authColors.appleButtonText }]}>
            Continue with Apple
          </Text>
        </Pressable>
      ) : null}
      {/* Google Button */}
      <Pressable
        style={({ pressed }) => [
          styles.googleButton,
          { backgroundColor: authColors.googleButtonBackground },
          pressed && styles.buttonPressed,
        ]}
        onPress={onGooglePress}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        testID="auth-google-button"
      >
        <Image
          source={require('@/assets/images/auth/google-logo.svg')}
          style={styles.googleLogo}
          contentFit="contain"
        />
        <Text style={[styles.buttonText, { color: authColors.googleButtonText }]}>
          Continue with Google
        </Text>
      </Pressable>

      {/* Login or Sign Up Button */}
      <Pressable
        style={({ pressed }) => [
          styles.loginButton,
          { backgroundColor: authColors.loginButtonBackground },
          pressed && styles.buttonPressed,
        ]}
        onPress={onLoginPress}
        accessibilityRole="button"
        accessibilityLabel="Log in or sign up"
        testID="auth-login-button"
      >
        <Text style={[styles.buttonText, { color: authColors.loginButtonText }]}>
          Log in or sign up
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: AuthTokens.spacing.sheetRadius,
    borderTopRightRadius: AuthTokens.spacing.sheetRadius,
    paddingTop: AuthTokens.spacing.sheetPaddingTop,
    paddingHorizontal: AuthTokens.spacing.sheetPaddingHorizontal,
    gap: AuthTokens.spacing.sheetGap,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  appleButton: {
    height: AuthTokens.spacing.buttonHeight,
    borderRadius: AuthTokens.spacing.buttonRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AuthTokens.spacing.buttonGap,
    alignSelf: 'stretch',
  },
  appleLogo: {
    width: 18,
    height: 21,
  },
  googleButton: {
    height: AuthTokens.spacing.buttonHeight,
    borderRadius: AuthTokens.spacing.buttonRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AuthTokens.spacing.buttonGap,
    alignSelf: 'stretch',
  },
  googleLogo: {
    width: 24,
    height: 24,
  },
  loginButton: {
    height: AuthTokens.spacing.buttonHeight,
    borderRadius: AuthTokens.spacing.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  buttonText: {
    fontSize: AuthTokens.typography.buttonText.fontSize,
    fontWeight: AuthTokens.typography.buttonText.fontWeight,
    lineHeight: AuthTokens.typography.buttonText.lineHeight,
  },
});
