import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type CheckPhoneContentProps = {
  phoneNumber?: string;
  onSubmitCode?: (code: string) => void;
  onResendCode?: () => void;
  initialCodeError?: string | null;
};

export const DUMMY_VALID_PHONE_CODE = '123456';

export function CheckPhoneContent({
  phoneNumber = '+62 812-3456-7890',
  onSubmitCode,
  onResendCode,
  initialCodeError = null,
}: CheckPhoneContentProps) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(initialCodeError);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  // Countdown timer for Resend code button
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const isCodeFilled = code.length > 0;
  const isIncorrectOrExpired =
    codeError === 'Invalid 6-digit code. Please try again.';

  const handleCodeChange = (text: string) => {
    // Only digits, max 6 chars
    const numericOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(numericOnly);
    if (codeError) {
      setCodeError(null);
    }
  };

 const handleSubmit = () => {
   Keyboard.dismiss();

   const trimmedCode = code.trim();

   if (!trimmedCode) {
      setCodeError('Please enter your 6-digit code to continue.');
     return;
   }

   if (trimmedCode !== DUMMY_VALID_PHONE_CODE) {
      setCodeError('Invalid 6-digit code. Please try again.');
     return;
   }

   setCodeError(null);
    onSubmitCode?.(trimmedCode);
  };

  const handleResendPress = () => {
    if (countdown > 0) return;
    setCountdown(60);
    setCodeError(null);
    onResendCode?.();
  };

  const formattedPhoneNumber = phoneNumber || '+62 812-3456-7890';

  return (
    <View style={styles.contentColumn} testID="check-phone-content">
      {/* Header Title & Subtitle */}
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="check-phone-title">
          Check your phone
        </Text>
        <Text style={[styles.subtitleText, { color: theme.textSecondary }]} testID="check-phone-subtitle">
          We’ll send a verification code via SMS to {formattedPhoneNumber}.
        </Text>
      </View>

      {/* Spacer 8px */}
      <View style={styles.spacer8} />

      {/* Code Text Field */}
      <View style={styles.inputSection}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: isFocused ? theme.inputBorderActive : theme.inputBorder,
            },
            isFocused && styles.textInputWrapperFocused,
            isIncorrectOrExpired && styles.textInputWrapperError,
          ]}
        >
          <View style={styles.textColumn}>
            {isCodeFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="check-phone-code-label">
                6-digit code
              </Text>
            )}
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: theme.inputText }, isCodeFilled && styles.textInputFilled]}
              value={code}
              onChangeText={handleCodeChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isCodeFilled ? undefined : '6-digit code'}
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="number-pad"
              maxLength={6}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="6-digit verification code"
              testID="check-phone-code-input"
            />
          </View>
        </View>

        {/* Error Message Container */}
        {Boolean(codeError) && (
          <View style={styles.errorRow} testID="code-error-container">
            <View
              style={[
                styles.exclamationCircle,
                isIncorrectOrExpired && styles.exclamationCircleError,
              ]}
            >
              <Text
                style={[
                  styles.exclamationMark,
                  isIncorrectOrExpired && styles.exclamationMarkError,
                ]}
              >
                !
              </Text>
            </View>
            <Text
              style={[
                styles.errorText,
                isIncorrectOrExpired && styles.errorTextRed,
              ]}
              testID="code-error-text"
            >
              {codeError}
            </Text>
          </View>
        )}
      </View>

      {/* Spacer 4px */}
      <View style={styles.spacer4} />

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
        testID="check-phone-continue-button"
      >
        <Text style={[styles.continueButtonText, { color: theme.buttonPrimaryText }]}>Continue</Text>
      </Pressable>
      {/* Resend Code Secondary Action */}
      <Pressable
        onPress={handleResendPress}
        disabled={countdown > 0}
        accessibilityRole="button"
        accessibilityLabel={
          countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'
        }
        accessibilityState={{ disabled: countdown > 0 }}
        testID="resend-code-button"
      >
        <Text
          style={[
            styles.resendCodeText,
            countdown > 0 ? styles.resendCodeDisabled : styles.resendCodeActive,
          ]}
        >
          {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
        </Text>
      </Pressable>

      {/* Flex Spacer */}
      <View style={styles.flexSpacer} />

      {/* Terms of Use & Privacy Policy Footer */}
      <Text style={[styles.footerText, { color: theme.textMuted }]} testID="check-phone-footer">
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

export type CheckPhoneSheetProps = CheckPhoneContentProps & {
  isVisible: boolean;
  onClosePress: () => void;
  onBackPress?: () => void;
  requireCloseConfirmation?: boolean;
  closeConfirmationTitle?: string;
  closeConfirmationMessage?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
};

export function CheckPhoneSheet({
  isVisible,
  onClosePress,
  onBackPress,
  requireCloseConfirmation = true,
  closeConfirmationTitle = 'Leave Verification?',
  closeConfirmationMessage = 'Are you sure you want to leave verification?',
  confirmButtonText = 'Leave',
  cancelButtonText = 'Cancel',
  ...contentProps
}: CheckPhoneSheetProps) {
 return (
   <ModalBottomSheet
     isVisible={isVisible}
     onClose={onClosePress}
     showBackButton={false}
     onBackPress={onBackPress}
     requireCloseConfirmation={requireCloseConfirmation}
      closeConfirmationTitle={closeConfirmationTitle}
      closeConfirmationMessage={closeConfirmationMessage}
      confirmButtonText={confirmButtonText}
      cancelButtonText={cancelButtonText}
      testID="check-phone-modal"
      closeButtonTestID="check-phone-sheet-close-button"
      backButtonTestID="check-phone-sheet-back-button"
    >
      <CheckPhoneContent {...contentProps} />
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  contentColumn: {
    flex: 1,
    gap: 14,
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
  spacer4: {
    height: 4,
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
  textInputWrapperError: {
    borderColor: AuthTokens.colors.inputErrorBorder,
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
  exclamationCircleError: {
    borderColor: AuthTokens.colors.inputErrorBorder,
  },
  exclamationMark: {
    color: AuthTokens.colors.emailErrorIcon,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    marginTop: -1,
  },
  exclamationMarkError: {
    color: AuthTokens.colors.inputErrorBorder,
  },
  errorText: {
    color: AuthTokens.colors.emailErrorText,
    fontSize: AuthTokens.typography.errorText.fontSize,
    fontWeight: AuthTokens.typography.errorText.fontWeight,
    lineHeight: AuthTokens.typography.errorText.lineHeight,
  },
  errorTextRed: {
    color: AuthTokens.colors.inputErrorBorder,
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
  resendCodeText: {
    fontSize: AuthTokens.typography.sheetSubtitle.fontSize,
    lineHeight: AuthTokens.typography.sheetSubtitle.lineHeight,
    textAlign: 'center',
    marginTop: 2,
  },
  resendCodeDisabled: {
    color: AuthTokens.colors.dividerText,
    fontWeight: '400',
  },
  resendCodeActive: {
    color: AuthTokens.colors.textPrimary,
    fontWeight: '600',
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
  pressed: {
    opacity: 0.82,
  },
});
