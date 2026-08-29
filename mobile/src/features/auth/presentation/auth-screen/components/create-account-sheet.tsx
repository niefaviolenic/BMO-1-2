import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizeDateOfBirth } from '@/features/auth/domain/date-of-birth';
import { AuthContinueButton } from './auth-continue-button';

export type CreateAccountPayload = {
  email: string;
  password: string;
  dateOfBirth: string;
};

export type CreateAccountContentProps = {
  initialPasswordError?: string | null;
  initialDateOfBirthError?: string | null;
  email: string;
  onEmailChange?: (email: string) => void;
  onSubmitAccount?: (payload: CreateAccountPayload) => void;
  initialPassword?: string;
  isSubmitting?: boolean;
};

export function CreateAccountContent({
  email,
  onEmailChange,
  onSubmitAccount,
  initialPassword = '',
  initialPasswordError = null,
  initialDateOfBirthError = null,
  isSubmitting = false,
}: CreateAccountContentProps) {
  const theme = useTheme();
  const [currentEmail, setCurrentEmail] = useState(email);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(initialPasswordError);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfBirthError, setDateOfBirthError] = useState<string | null>(initialDateOfBirthError);
  const [isDateOfBirthFocused, setIsDateOfBirthFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [password, setPassword] = useState(initialPassword);
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [selection, setSelection] = useState({
    start: initialPassword.length,
    end: initialPassword.length,
  });

  const passwordInputRef = useRef<TextInput>(null);
  const securePasswordInputRef = useRef<TextInput>(null);
  const visiblePasswordInputRef = useRef<TextInput>(null);
  const shouldRestoreFocusRef = useRef(false);
  const isSwitchingPasswordInputRef = useRef(false);
  const passwordBeforeSecureInputRef = useRef<string | null>(null);
  const selectionBeforeSecureInputRef = useRef(selection);
  const pendingSecureKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setCurrentEmail(email);
    setEmailError(null);
  }, [email]);

  useEffect(() => {
    setPasswordError(initialPasswordError);
  }, [initialPasswordError]);

  useEffect(() => {
    setDateOfBirthError(initialDateOfBirthError);
  }, [initialDateOfBirthError]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !shouldRestoreFocusRef.current) return;

    const frame = requestAnimationFrame(() => {
      const nextInput = isPasswordVisible
        ? visiblePasswordInputRef.current
        : securePasswordInputRef.current;
      nextInput?.focus();
      shouldRestoreFocusRef.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [isPasswordVisible]);

  useEffect(() => {
    setPassword(initialPassword);
    setSelection({ start: initialPassword.length, end: initialPassword.length });
  }, [initialPassword]);

  const isEmailFilled = currentEmail.length > 0;
  const isPasswordFilled = password.length > 0;
  const isDateOfBirthFilled = dateOfBirth.length > 0;
  const isInvalidEmail = Boolean(emailError);
  const isPasswordMinLengthMet = password.length >= 12;

  const handleEmailChange = (text: string) => {
    setCurrentEmail(text);
    onEmailChange?.(text);
    if (emailError) {
      setEmailError(null);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError(null);
  };

  const handleSecurePasswordKeyPress = (key: string) => {
    if (passwordBeforeSecureInputRef.current !== null) {
      pendingSecureKeyRef.current = key;
    }
  };

  const handleSecurePasswordChange = (text: string) => {
    const previousPassword = passwordBeforeSecureInputRef.current;
    const pressedKey = pendingSecureKeyRef.current;

    passwordBeforeSecureInputRef.current = null;
    pendingSecureKeyRef.current = null;

    if (previousPassword === null || pressedKey === null || pressedKey === 'Enter') {
      setPassword(text);
      if (passwordError) setPasswordError(null);
      return;
    }

    const { start, end } = selectionBeforeSecureInputRef.current;
    let expectedPassword: string;
    let nextCursor: number;

    if (pressedKey === 'Backspace') {
      if (start !== end) {
        expectedPassword =
          previousPassword.slice(0, start) + previousPassword.slice(end);
        nextCursor = start;
      } else if (start > 0) {
        expectedPassword =
          previousPassword.slice(0, start - 1) + previousPassword.slice(end);
        nextCursor = start - 1;
      } else {
        expectedPassword = previousPassword;
        nextCursor = 0;
      }
    } else {
      expectedPassword =
        previousPassword.slice(0, start) +
        pressedKey +
        previousPassword.slice(end);
      nextCursor = start + pressedKey.length;
    }

    setPassword(text === expectedPassword ? text : expectedPassword);
    setSelection({ start: nextCursor, end: nextCursor });
    if (passwordError) setPasswordError(null);
  };

  const handlePasswordFocus = () => {
    isSwitchingPasswordInputRef.current = false;
    setIsFocused(true);
  };

  const handlePasswordBlur = () => {
    if (!isSwitchingPasswordInputRef.current) {
      setIsFocused(false);
    }
  };

  const handleSubmit = () => {
    Keyboard.dismiss();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = currentEmail.trim();

    if (!trimmedEmail || !password) {
      if (!trimmedEmail) {
        setEmailError(null);
      }
      setPasswordError('Please enter your email and password to continue.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError(null);

    if (!isPasswordMinLengthMet) {
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

    setPasswordError(null);
    setDateOfBirthError(null);
    onSubmitAccount?.({
      email: trimmedEmail,
      password,
      dateOfBirth: normalizedDateOfBirth,
    });
  };

  const togglePasswordVisibility = () => {
    if (Platform.OS === 'ios') {
      const activeInput = isPasswordVisible
        ? visiblePasswordInputRef.current
        : securePasswordInputRef.current;
      shouldRestoreFocusRef.current = activeInput?.isFocused() ?? isFocused;
      isSwitchingPasswordInputRef.current = shouldRestoreFocusRef.current;

      if (isPasswordVisible) {
        passwordBeforeSecureInputRef.current = password;
        selectionBeforeSecureInputRef.current = selection;
        pendingSecureKeyRef.current = null;
      } else {
        passwordBeforeSecureInputRef.current = null;
        pendingSecureKeyRef.current = null;
      }
    }
    setIsPasswordVisible((prev) => !prev);
  };

  return (
    <View style={styles.contentColumn}>
      {/* Header Title & Subtitle */}
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="create-account-title">
          Create Your Account
        </Text>
        <Text style={[styles.subtitleText, { color: theme.textSecondary }]} testID="create-account-subtitle">
          Set Your Password for Joy to Continue
        </Text>
      </View>

      {/* Spacer 8px */}
      <View style={styles.spacer8} />

      {/* Editable Email Input Field */}
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
          testID="email-readonly-container"
        >
          <View style={styles.textColumn}>
            {isEmailFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="email-readonly-label">
                Email
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isEmailFilled && styles.textInputFilled]}
              value={currentEmail}
              onChangeText={handleEmailChange}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              placeholder={isEmailFilled ? undefined : 'Email'}
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="email-address"
              autoCorrect={false}
              accessibilityLabel="Email address"
              testID="create-account-email-input"
            />
          </View>
        </View>

        {/* Error Message with Exclamation Icon */}
        {isInvalidEmail && (
          <View style={styles.errorRow} testID="email-error-container">
            <View style={styles.exclamationCircle}>
              <Text style={styles.exclamationMark}>!</Text>
            </View>
            <Text style={styles.errorText} testID="email-error-text">
              {emailError}
            </Text>
          </View>
        )}
      </View>

      {/* Password Input Field */}
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
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="password-input-label">
                Password
              </Text>
            )}
            {Platform.OS === 'ios' ? (
              <View style={styles.passwordInputStack}>
                <TextInput
                  ref={securePasswordInputRef}
                  style={[
                    styles.textInput,
                    styles.passwordInputLayer,
                    isPasswordFilled && styles.textInputFilled,
                    isPasswordVisible && styles.passwordInputHidden,
                  ]}
                  value={password}
                  onChangeText={handleSecurePasswordChange}
                  onKeyPress={(e) =>
                    handleSecurePasswordKeyPress(e.nativeEvent.key)
                  }
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  placeholder={isPasswordFilled ? undefined : 'Password'}
                  placeholderTextColor={theme.inputPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selection={!isPasswordVisible ? selection : undefined}
                  onSelectionChange={
                    !isPasswordVisible
                      ? (e) => setSelection(e.nativeEvent.selection)
                      : undefined
                  }
                  pointerEvents={isPasswordVisible ? 'none' : 'auto'}
                  accessibilityElementsHidden={isPasswordVisible}
                  accessibilityLabel="Password"
                  testID={!isPasswordVisible ? 'create-account-password-input' : undefined}
                />
                <TextInput
                  ref={visiblePasswordInputRef}
                  style={[
                    styles.textInput,
                    styles.passwordInputLayer,
                    isPasswordFilled && styles.textInputFilled,
                    !isPasswordVisible && styles.passwordInputHidden,
                  ]}
                  value={password}
                  onChangeText={handlePasswordChange}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  placeholder={isPasswordFilled ? undefined : 'Password'}
                  placeholderTextColor={theme.inputPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selection={isPasswordVisible ? selection : undefined}
                  onSelectionChange={
                    isPasswordVisible
                      ? (e) => setSelection(e.nativeEvent.selection)
                      : undefined
                  }
                  pointerEvents={isPasswordVisible ? 'auto' : 'none'}
                  accessibilityElementsHidden={!isPasswordVisible}
                  accessibilityLabel="Password"
                  testID={isPasswordVisible ? 'create-account-password-input' : undefined}
                />
              </View>
            ) : (
              <TextInput
                ref={passwordInputRef}
                style={[styles.textInput, isPasswordFilled && styles.textInputFilled]}
                value={password}
                onChangeText={handlePasswordChange}
                onFocus={handlePasswordFocus}
                onBlur={handlePasswordBlur}
                placeholder={isPasswordFilled ? undefined : 'Password'}
                placeholderTextColor={theme.inputPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Password"
                testID="create-account-password-input"
              />
            )}
          </View>
          <Pressable
            onPress={togglePasswordVisibility}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            testID="create-account-password-eye-toggle"
          >
            <Image
              source={
                isPasswordVisible
                  ? require('@/assets/images/auth/eye-off-icon.svg')
                  : require('@/assets/images/auth/eye-icon.svg')
              }
              style={styles.eyeIcon}
              contentFit="contain"
            />
          </Pressable>
        </View>

       {/* Live Password Information Declaration */}
       {Boolean(passwordError) ? (
         <View style={styles.errorRow} testID="password-declaration-container">
           <View style={styles.declarationCircle}>
             <Text style={styles.declarationIconMark}>!</Text>
           </View>
           <Text style={styles.declarationText} testID="password-declaration-text">
             {passwordError}
           </Text>
         </View>
       ) : (
          isPasswordFilled && (
            <View style={styles.errorRow} testID="password-declaration-container">
              <View style={styles.declarationCircle}>
                <Text style={styles.declarationIconMark}>
                  {isPasswordMinLengthMet ? '✓' : '!'}
                </Text>
              </View>
              <Text style={styles.declarationText} testID="password-declaration-text">
                {isPasswordMinLengthMet
                  ? 'Contains 12 characters'
                  : 'Password must contain at least 12 characters'}
              </Text>
            </View>
          )
       )}
     </View>

      <View style={styles.inputSection}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: isDateOfBirthFocused ? theme.inputBorderActive : theme.inputBorder,
            },
            isDateOfBirthFocused && styles.textInputWrapperFocused,
            Boolean(dateOfBirthError) && styles.textInputWrapperError,
          ]}
        >
          <View style={styles.textColumn}>
            {isDateOfBirthFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="date-of-birth-input-label">
                Date of birth
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isDateOfBirthFilled && styles.textInputFilled]}
              onChangeText={(text) => {
                setDateOfBirth(text);
                if (dateOfBirthError) {
                  setDateOfBirthError(null);
                }
              }}
              onFocus={() => setIsDateOfBirthFocused(true)}
              onBlur={() => setIsDateOfBirthFocused(false)}
              placeholder={isDateOfBirthFilled ? undefined : 'Date of birth (YYYY-MM-DD)'}
              placeholderTextColor={theme.inputPlaceholder}
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Date of birth"
              testID="create-account-dob-input"
            />
          </View>
        </View>
        {Boolean(dateOfBirthError) && (
          <View style={styles.errorRow} testID="dob-error-container">
            <View style={styles.exclamationCircle}>
              <Text style={styles.exclamationMark}>!</Text>
            </View>
            <Text style={styles.errorText} testID="dob-error-text">
              {dateOfBirthError}
            </Text>
          </View>
        )}
      </View>

      {/* Spacer 4px */}
      <View style={styles.spacer4} />

      {/* Continue Button */}
      <AuthContinueButton
        onPress={handleSubmit}
        loading={isSubmitting}
        testID="create-account-continue-button"
        loadingAccessibilityLabel="Creating account"
      />

      {/* Flex Spacer */}
      <View style={styles.flexSpacer} />

      {/* Terms of Use & Privacy Policy Footer */}
      <Text style={[styles.footerText, { color: theme.textMuted }]} testID="create-account-footer">
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

export type CreateAccountSheetProps = CreateAccountContentProps & {
  isVisible: boolean;
  onBackPress: () => void;
  onClosePress: () => void;
};

export function CreateAccountSheet({
  isVisible,
  onBackPress,
  onClosePress,
  ...contentProps
}: CreateAccountSheetProps) {
  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClosePress}
      showBackButton={true}
      onBackPress={onBackPress}
      testID="create-account-modal"
      closeButtonTestID="create-account-sheet-close-button"
      backButtonTestID="create-account-sheet-back-button"
    >
      <CreateAccountContent {...contentProps} />
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
  exclamationMark: {
    color: AuthTokens.colors.emailErrorIcon,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    marginTop: -1,
  },
  declarationCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: AuthTokens.colors.emailErrorIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declarationIconMark: {
    color: AuthTokens.colors.emailErrorIcon,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    marginTop: -1,
  },
  declarationText: {
    color: AuthTokens.colors.emailErrorText,
    fontSize: AuthTokens.typography.errorText.fontSize,
    fontWeight: AuthTokens.typography.errorText.fontWeight,
    lineHeight: AuthTokens.typography.errorText.lineHeight,
  },
  errorText: {
    color: AuthTokens.colors.emailErrorText,
    fontSize: AuthTokens.typography.errorText.fontSize,
    fontWeight: AuthTokens.typography.errorText.fontWeight,
    lineHeight: AuthTokens.typography.errorText.lineHeight,
  },
  passwordInputStack: {
    height: AuthTokens.typography.inputText.lineHeight,
    position: 'relative',
  },
  passwordInputLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  passwordInputHidden: {
    opacity: 0,
  },
  eyeIcon: {
    width: 20,
    height: 20,
    marginLeft: 8,
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
});
