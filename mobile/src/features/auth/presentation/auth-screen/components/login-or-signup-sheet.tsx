import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export const EMAIL_ONLY_AUTH_MESSAGE =
  'Continue with email. Apple, Google, and phone sign-in are not available yet.';

export type LoginOrSignUpContentProps = {
  initialEmail?: string;
  initialError?: string | null;
  onGooglePress?: () => void;
  onApplePress?: () => void;
  onPhonePress?: () => void;
  onSubmitEmail?: (email: string) => void;
  onCreateAccountPress?: (email: string) => void;
  showApple?: boolean;
  showPhone?: boolean;
};

export function LoginOrSignUpContent({
  initialEmail = '',
  initialError = null,
  onGooglePress,
  onApplePress,
  onPhonePress,
  onSubmitEmail,
  onCreateAccountPress,
  showApple = false,
  showPhone = false,
}: LoginOrSignUpContentProps) {
  const theme = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(initialError);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setEmail(initialEmail);
    setError(initialError);
  }, [initialEmail, initialError]);

  const isFilled = email.trim().length > 0;
  const isInvalidEmail = Boolean(error);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) {
      setError(null);
    }
  };

 const handleSubmit = () => {
   Keyboard.dismiss();

   if (!isFilled) {
     setError('Please enter your email to continue.');
     return;
   }

   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim();
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    onSubmitEmail?.(trimmedEmail);
  };

  const handleCreateAccountPress = () => {
    Keyboard.dismiss();

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    onCreateAccountPress?.(trimmedEmail);
  };

  return (
    <View style={styles.contentColumn}>
      {/* Header Title & Subtitle */}
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="login-or-signup-title">
          Log in or sign up
        </Text>
        <Text style={[styles.subtitleText, { color: theme.textSecondary }]} testID="login-or-signup-subtitle">
          You’ll get smarter responses and can upload files, images and more.
        </Text>
      </View>

      {/* Spacer 8px */}
      <View style={styles.spacer8} />

      {/* Email Input Field */}
      <View style={styles.inputSection}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: isFocused ? theme.inputBorderActive : theme.inputBorder,
            },
            isFocused && styles.textInputWrapperFocused,
          ]}
        >
          <View style={styles.textColumn}>
            {isFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="email-input-label">
                Email
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isFilled && styles.textInputFilled]}
              value={email}
              onChangeText={handleEmailChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isFilled ? undefined : 'Email'}
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
              accessibilityLabel="Email address"
              testID="email-input"
            />
          </View>
        </View>

        {/* Error Message with Exclamation Icon in Darker Grey */}
        {isInvalidEmail && (
          <View style={styles.errorRow} testID="email-error-container">
            <View style={styles.exclamationCircle}>
              <Text style={styles.exclamationMark}>!</Text>
            </View>
            <Text style={styles.errorText} testID="email-error-text">
              {error}
            </Text>
          </View>
        )}
      </View>

      {/* Continue Button */}
      <Pressable
        style={({ pressed }) => [
          styles.continueButton,
          { backgroundColor: theme.buttonPrimaryBackground },
          pressed && styles.pressed,
        ]}
        onPress={handleSubmit}
        accessibilityRole="button"
        accessibilityLabel="Continue"
        testID="continue-button"
      >
        <Text style={[styles.continueButtonText, { color: theme.buttonPrimaryText }]}>Continue</Text>
      </Pressable>

      <Pressable
        onPress={handleCreateAccountPress}
        accessibilityRole="button"
        accessibilityLabel="Create account"
        testID="create-account-link"
      >
        <Text style={[styles.createAccountText, { color: theme.textSecondary }]}>Create account</Text>
      </Pressable>

      {/* OR Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
        <Text style={[styles.dividerText, { color: theme.textMuted }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
      </View>

      {/* Secondary SSO Buttons */}
      <View style={styles.ssoGroup}>
        {/* Google Button */}
        <Pressable
          style={({ pressed }) => [
            styles.ssoButton,
            {
              backgroundColor: theme.buttonSecondaryBackground,
              borderColor: theme.buttonSecondaryBorder,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            Keyboard.dismiss();
            onGooglePress?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          testID="email-google-button"
        >
          <Image
            source={require('@/assets/images/auth/google-logo.svg')}
            style={styles.ssoIcon}
            contentFit="contain"
          />
          <Text style={[styles.ssoButtonText, { color: theme.buttonSecondaryText }]}>Continue with Google</Text>
        </Pressable>

{showApple ? (
        <Pressable
          style={({ pressed }) => [
            styles.ssoButton,
            {
              backgroundColor: theme.buttonSecondaryBackground,
              borderColor: theme.buttonSecondaryBorder,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            Keyboard.dismiss();
            onApplePress?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          testID="email-apple-button"
        >
          <Image
            source={require('@/assets/images/auth/apple-logo.svg')}
            style={styles.ssoIcon}
            contentFit="contain"
          />
          <Text style={[styles.ssoButtonText, { color: theme.buttonSecondaryText }]}>Continue with Apple</Text>
        </Pressable>
      ) : null}
{showPhone ? (
        <Pressable
          style={({ pressed }) => [
            styles.ssoButton,
            {
              backgroundColor: theme.buttonSecondaryBackground,
              borderColor: theme.buttonSecondaryBorder,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            Keyboard.dismiss();
            onPhonePress?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue with phone"
          testID="email-phone-button"
        >
          <Image
            source={require('@/assets/images/auth/phone-icon.svg')}
            style={styles.ssoIcon}
            contentFit="contain"
          />
          <Text style={[styles.ssoButtonText, { color: theme.buttonSecondaryText }]}>Continue with phone</Text>
        </Pressable>
      ) : null}
      </View>

      {/* Flex Spacer */}
      <View style={styles.flexSpacer} />

      {/* Terms of Use & Privacy Policy Footer */}
      <Text style={[styles.footerText, { color: theme.textMuted }]} testID="login-or-signup-footer">
        <Text style={[styles.footerLink, { color: theme.textSecondary }]} testID="terms-of-use-link">
          Terms of Use
        </Text>
        <Text>{'  •  '}</Text>
        <Text style={[styles.footerLink, { color: theme.textSecondary }]} testID="privacy-policy-link">
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

export type LoginOrSignUpSheetProps = LoginOrSignUpContentProps & {
  isVisible: boolean;
  onBackPress: () => void;
};

export function LoginOrSignUpSheet({
  isVisible,
  onBackPress,
  ...contentProps
}: LoginOrSignUpSheetProps) {
  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onBackPress}
      testID="login-or-signup-modal"
      closeButtonTestID="auth-email-close-button"
    >
      <LoginOrSignUpContent {...contentProps} />
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  contentColumn: {
    flex: 1,
    gap: 16,
  },
  flexSpacer: {
    flex: 1,
    minHeight: 16,
  },
  footerText: {
    color: AuthTokens.colors.legalFooterText,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
  headerGroup: {
    alignItems: 'center',
  },
  titleText: {
    color: AuthTokens.colors.emailSheetTitle,
    fontSize: AuthTokens.typography.sheetTitle.fontSize,
    fontWeight: AuthTokens.typography.sheetTitle.fontWeight,
    lineHeight: AuthTokens.typography.sheetTitle.lineHeight,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitleText: {
    color: AuthTokens.colors.emailSheetSubtitle,
    fontSize: AuthTokens.typography.sheetSubtitle.fontSize,
    fontWeight: AuthTokens.typography.sheetSubtitle.fontWeight,
    lineHeight: AuthTokens.typography.sheetSubtitle.lineHeight,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  spacer8: {
    height: 8,
  },
  inputSection: {
    gap: 4,
  },
  textInputWrapper: {
    height: AuthTokens.spacing.buttonHeight,
    backgroundColor: AuthTokens.colors.emailInputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AuthTokens.colors.emailInputBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  textInputWrapperFocused: {
    borderColor: AuthTokens.colors.emailInputBorderActive,
    borderWidth: 1.5,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  inputLabel: {
    color: AuthTokens.colors.emailInputLabel,
    fontSize: AuthTokens.typography.inputLabel.fontSize,
    fontWeight: AuthTokens.typography.inputLabel.fontWeight,
    lineHeight: AuthTokens.typography.inputLabel.lineHeight,
    marginBottom: 1,
  },
  textInput: {
    color: AuthTokens.colors.emailInputText,
    fontSize: AuthTokens.typography.inputText.fontSize,
    fontWeight: AuthTokens.typography.inputText.fontWeight,
    lineHeight: AuthTokens.typography.inputText.lineHeight,
    padding: 0,
    margin: 0,
  },
  textInputFilled: {
    lineHeight: 20,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingLeft: 2,
  },
  exclamationCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: AuthTokens.colors.emailErrorIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exclamationMark: {
    color: AuthTokens.colors.emailErrorIcon,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    marginTop: -1,
  },
  errorText: {
    color: AuthTokens.colors.emailErrorText,
    fontSize: AuthTokens.typography.errorText.fontSize,
    fontWeight: AuthTokens.typography.errorText.fontWeight,
    lineHeight: AuthTokens.typography.errorText.lineHeight,
  },
  continueButton: {
    height: AuthTokens.spacing.buttonHeight,
    backgroundColor: AuthTokens.colors.continueButtonBackground,
    borderRadius: AuthTokens.spacing.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  continueButtonText: {
    color: AuthTokens.colors.continueButtonText,
    fontSize: AuthTokens.typography.buttonText.fontSize,
    fontWeight: AuthTokens.typography.buttonText.fontWeight,
    lineHeight: AuthTokens.typography.buttonText.lineHeight,
  },
  createAccountText: {
    color: AuthTokens.colors.forgotPasswordText,
    fontSize: AuthTokens.typography.sheetSubtitle.fontSize,
    fontWeight: AuthTokens.typography.sheetSubtitle.fontWeight,
    lineHeight: AuthTokens.typography.sheetSubtitle.lineHeight,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AuthTokens.colors.dividerLine,
  },
  dividerText: {
    color: AuthTokens.colors.dividerText,
    fontSize: AuthTokens.typography.dividerText.fontSize,
    fontWeight: AuthTokens.typography.dividerText.fontWeight,
    lineHeight: AuthTokens.typography.dividerText.lineHeight,
    marginHorizontal: 16,
  },
  ssoGroup: {
    gap: 10,
  },
  ssoButton: {
    height: AuthTokens.spacing.buttonHeight,
    backgroundColor: AuthTokens.colors.ssoButtonBackground,
    borderRadius: AuthTokens.spacing.buttonRadius,
    borderWidth: 1,
    borderColor: AuthTokens.colors.ssoButtonBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AuthTokens.spacing.buttonGap,
    alignSelf: 'stretch',
  },
  ssoIcon: {
    width: 20,
    height: 20,
  },
  ssoButtonText: {
    color: AuthTokens.colors.ssoButtonText,
    fontSize: AuthTokens.typography.ssoButtonText.fontSize,
    fontWeight: AuthTokens.typography.ssoButtonText.fontWeight,
    lineHeight: AuthTokens.typography.ssoButtonText.lineHeight,
  },
  pressed: {
    opacity: 0.82,
  },
});
