import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthContinueButton } from './auth-continue-button';

export type RecoveryPasswordContentProps = {
  onSubmit?: (password: string) => void;
  initialError?: string | null;
  isSubmitting?: boolean;
};

export function RecoveryPasswordContent({
  onSubmit,
  initialError = null,
  isSubmitting = false,
}: RecoveryPasswordContentProps) {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  const isPasswordFilled = password.length > 0;
  const isPasswordMinLengthMet = password.length >= 12;

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (!isPasswordMinLengthMet) {
      setError('Password must contain at least 12 characters');
      return;
    }

    setError(null);
    onSubmit?.(password);
  };

  return (
    <View style={styles.contentColumn}>
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="recovery-password-title">
          Choose a new password
        </Text>
        <Text style={[styles.subtitleText, { color: theme.textSecondary }]} testID="recovery-password-subtitle">
          Use at least 12 characters
        </Text>
      </View>

      <View style={styles.spacer8} />

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
            {isPasswordFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="recovery-password-label">
                New password
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isPasswordFilled && styles.textInputFilled]}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isPasswordFilled ? undefined : 'New password'}
              placeholderTextColor={theme.inputPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="New password"
              testID="recovery-password-input"
            />
          </View>
        </View>
        {Boolean(error) && (
          <Text style={styles.errorText} testID="recovery-password-error-text">
            {error}
          </Text>
        )}
      </View>

      <AuthContinueButton
        onPress={handleSubmit}
        loading={isSubmitting}
        testID="recovery-password-continue-button"
        loadingAccessibilityLabel="Updating"
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
