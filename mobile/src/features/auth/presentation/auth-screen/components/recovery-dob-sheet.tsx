import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizeDateOfBirth } from '@/features/auth/domain/date-of-birth';
import { AuthContinueButton } from './auth-continue-button';
export type RecoveryDobContentProps = {
  email: string;
  onEmailChange?: (email: string) => void;
  onSubmit?: (payload: { email: string; dateOfBirth: string }) => void;
  initialError?: string | null;
  isSubmitting?: boolean;
};

export function RecoveryDobContent({
  email,
  onEmailChange,
  onSubmit,
  initialError = null,
  isSubmitting = false,
}: RecoveryDobContentProps) {
  const theme = useTheme();
  const [currentEmail, setCurrentEmail] = useState(email);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [dateOfBirthError, setDateOfBirthError] = useState<string | null>(initialError);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isDateFocused, setIsDateFocused] = useState(false);

  useEffect(() => {
    setCurrentEmail(email);
  }, [email]);

  useEffect(() => {
    setDateOfBirthError(initialError);
  }, [initialError]);

  const isEmailFilled = currentEmail.length > 0;
  const isDateFilled = dateOfBirth.length > 0;

  const handleSubmit = () => {
    Keyboard.dismiss();
    const trimmedEmail = currentEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    const normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirth);
    if (!normalizedDateOfBirth) {
      setDateOfBirthError(
        dateOfBirth.trim()
          ? 'Enter a real past date as YYYY-MM-DD.'
          : 'Please enter your date of birth.',
      );
      return;
    }

    setEmailError(null);
    setDateOfBirthError(null);
    onSubmit?.({ email: trimmedEmail, dateOfBirth: normalizedDateOfBirth });
  };

  return (
    <View style={styles.contentColumn}>
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="recovery-dob-title">
          Reset your password
        </Text>
        <Text style={[styles.subtitleText, { color: theme.textSecondary }]} testID="recovery-dob-subtitle">
          Confirm your email and date of birth to continue
        </Text>
      </View>

      <View style={styles.spacer8} />

      <View style={styles.inputSection}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: isEmailFocused ? theme.inputBorderActive : theme.inputBorder,
            },
            isEmailFocused && styles.textInputWrapperFocused,
          ]}
        >
          <View style={styles.textColumn}>
            {isEmailFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="recovery-email-label">
                Email
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isEmailFilled && styles.textInputFilled]}
              value={currentEmail}
              onChangeText={(text) => {
                setCurrentEmail(text);
                onEmailChange?.(text);
                if (emailError) setEmailError(null);
              }}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              placeholder={isEmailFilled ? undefined : 'Email'}
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email address"
              testID="recovery-email-input"
            />
          </View>
        </View>
        {Boolean(emailError) && (
          <Text style={styles.errorText} testID="recovery-email-error-text">
            {emailError}
          </Text>
        )}
      </View>

      <View style={styles.inputSection}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: isDateFocused ? theme.inputBorderActive : theme.inputBorder,
            },
            isDateFocused && styles.textInputWrapperFocused,
          ]}
        >
          <View style={styles.textColumn}>
            {isDateFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="recovery-dob-label">
                Date of birth
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isDateFilled && styles.textInputFilled]}
              value={dateOfBirth}
              onChangeText={(text) => {
                setDateOfBirth(text);
                if (dateOfBirthError) setDateOfBirthError(null);
              }}
              onFocus={() => setIsDateFocused(true)}
              onBlur={() => setIsDateFocused(false)}
              placeholder={isDateFilled ? undefined : 'Date of birth (YYYY-MM-DD)'}
              placeholderTextColor={theme.inputPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Date of birth"
              testID="recovery-dob-input"
            />
          </View>
        </View>
        {Boolean(dateOfBirthError) && (
          <Text style={styles.errorText} testID="recovery-dob-error-text">
            {dateOfBirthError}
          </Text>
        )}
      </View>

      <AuthContinueButton
        onPress={handleSubmit}
        loading={isSubmitting}
        testID="recovery-dob-continue-button"
        loadingAccessibilityLabel="Checking"
      />
    </View>
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
  errorText: {
    color: AuthTokens.colors.emailErrorText,
    fontSize: AuthTokens.typography.errorText.fontSize,
    fontWeight: AuthTokens.typography.errorText.fontWeight,
    lineHeight: AuthTokens.typography.errorText.lineHeight,
    paddingLeft: 2,
  },
});
