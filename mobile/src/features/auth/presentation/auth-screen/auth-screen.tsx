import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { DEFAULT_COUNTRY, Country } from '@/constants/countries';
import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthTypingHeader } from '@/features/auth/components/auth-typing-header';
import { CountryPickerContent } from '@/features/auth/components/country-picker-modal';
import { useStepFadeTransition } from '@/hooks/use-step-fade-transition';
import { processedExchangeCodes, promptGoogleAuth } from '@/features/auth/data/google-oauth';
import { isApiError, isAuthenticationFailed } from '@/lib/api';

import { useAuthSession } from '../auth-session-provider';
import { AuthBottomSheet } from './components/auth-bottom-sheet';
import { CheckPhoneContent } from './components/check-phone-sheet';
import { CreateAccountContent } from './components/create-account-sheet';
import { EnterPhoneNumberContent } from './components/enter-phone-number-sheet';
import {
  EMAIL_ONLY_AUTH_MESSAGE,
  LoginOrSignUpContent,
} from './components/login-or-signup-sheet';
import {
  INCORRECT_PASSWORD_MESSAGE,
  LoginPasswordContent,
} from './components/login-password-sheet';
import { RecoveryDobContent } from './components/recovery-dob-sheet';
import { RecoveryPasswordContent } from './components/recovery-password-sheet';

export type AuthSheetStep =
  | 'none'
  | 'email'
  | 'phone'
  | 'select-country'
  | 'password'
  | 'create-account'
  | 'recovery-dob'
  | 'recovery-password'
  | 'check-phone';

export type AuthScreenProps = {
  onApplePress?: () => void;
  onGooglePress?: () => void;
  onLoginPress?: () => void;
  onSubmitEmail?: (email: string) => void;
  onSubmitPhoneNumber?: (phoneNumber: string) => void;
  onSubmitPassword?: (password: string) => void;
  onSubmitCode?: (code: string) => void;
  onResendEmail?: () => void;
  onResendPhoneCode?: () => void;
  initialStep?: AuthSheetStep;
  initialEmail?: string;
};

function toUserFacingError(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return error.message ?? 'Too many attempts. Try again later.';
    }
    if (error.code === 'CONFLICT') {
      return error.message ?? 'An account with this email already exists.';
    }
    if (error.code === 'INVALID_INPUT') {
      return error.message ?? fallback;
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message ?? 'Unable to sign in. Check your connection and try again.';
    }
  }

  return fallback;
}

export function AuthScreen({
  onApplePress,
  onGooglePress,
  onLoginPress,
  onSubmitEmail,
  onSubmitPhoneNumber,
  onSubmitPassword,
  onSubmitCode,
  onResendPhoneCode,
  initialStep = 'none',
  initialEmail = '',
}: AuthScreenProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const { login, loginGoogle, register, verifyRecovery, resetAccountPassword } = useAuthSession();
  const [currentStep, setCurrentStep] = useState<AuthSheetStep>(initialStep);
  const [submittedEmail, setSubmittedEmail] = useState(initialEmail);
  const [submittedPhoneNumber, setSubmittedPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [sheetResetKey, setSheetResetKey] = useState(0);
  const [passwordResetKey, setPasswordResetKey] = useState(0);
  const [phoneResetKey, setPhoneResetKey] = useState(0);
  const [emailSheetError, setEmailSheetError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top + 40, 100);

  const { activeStep, contentOpacity } = useStepFadeTransition({
    currentStep,
  });

  const resetTransientState = () => {
    setEmailSheetError(null);
    setPasswordError(null);
    setCreateAccountError(null);
    setRecoveryError(null);
    setRecoveryToken(null);
    setIsSubmitting(false);
  };

  const handleLoginPress = () => {
    setCurrentStep('email');
    setSubmittedEmail('');
    setSubmittedPhoneNumber('');
    setSheetResetKey((prev) => prev + 1);
    setPasswordResetKey((prev) => prev + 1);
    setPhoneResetKey((prev) => prev + 1);
    resetTransientState();
    onLoginPress?.();
  };

  const handleCloseSheet = () => {
    setCurrentStep('none');
    setSubmittedEmail('');
    setSubmittedPhoneNumber('');
    setSheetResetKey((prev) => prev + 1);
    setPasswordResetKey((prev) => prev + 1);
    setPhoneResetKey((prev) => prev + 1);
    resetTransientState();
  };

  const handleUnsupportedAuth = () => {
    setEmailSheetError(EMAIL_ONLY_AUTH_MESSAGE);
    setCurrentStep('email');
  };
  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    resetTransientState();
    try {
      onGooglePress?.();
      const tokens = await promptGoogleAuth();
      if (tokens.exchangeCode) {
        if (processedExchangeCodes.has(tokens.exchangeCode)) {
          handleCloseSheet();
          return;
        }
        processedExchangeCodes.add(tokens.exchangeCode);
      }
      await loginGoogle(tokens);
      handleCloseSheet();
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        return;
      }
      setEmailSheetError(toUserFacingError(error, 'Google sign-in failed. Try again.'));
      setCurrentStep('email');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSubmitEmail = (email: string) => {
    setSubmittedEmail(email);
    setPasswordError(null);
    setCurrentStep('password');
    setPasswordResetKey((prev) => prev + 1);
    onSubmitEmail?.(email);
  };

  const handleCreateAccountPress = (email: string) => {
    setSubmittedEmail(email);
    setCreateAccountError(null);
    setCurrentStep('create-account');
    setPasswordResetKey((prev) => prev + 1);
  };

  const handlePhonePress = () => {
    setCurrentStep('phone');
    setSubmittedPhoneNumber('');
    setPhoneResetKey((prev) => prev + 1);
  };

  const handleCountryPress = () => {
    setCurrentStep('select-country');
  };

  const handleSubmitPhoneNumber = (phoneNumber: string) => {
    setSubmittedPhoneNumber(phoneNumber);
    setCurrentStep('check-phone');
    onSubmitPhoneNumber?.(phoneNumber);
  };

  const handleBackToEmail = () => {
    if (currentStep === 'check-phone' || currentStep === 'select-country') {
      setCurrentStep('phone');
      return;
    }
    if (currentStep === 'recovery-password') {
      setCurrentStep('recovery-dob');
      return;
    }
    if (currentStep === 'recovery-dob') {
      setCurrentStep('password');
      return;
    }
    setCurrentStep('email');
    setPasswordResetKey((prev) => prev + 1);
    setSubmittedPhoneNumber('');
    setPhoneResetKey((prev) => prev + 1);
  };

  const handleSubmitPassword = async (password: string) => {
    onSubmitPassword?.(password);
    setIsSubmitting(true);
    setPasswordError(null);
    try {
      await login(submittedEmail, password);
    } catch (error) {
      if (isAuthenticationFailed(error)) {
        setPasswordError(INCORRECT_PASSWORD_MESSAGE);
      } else {
        setPasswordError(toUserFacingError(error, 'Unable to sign in. Try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAccount = async (payload: {
    email: string;
    password: string;
    dateOfBirth: string;
  }) => {
    setSubmittedEmail(payload.email);
    setIsSubmitting(true);
    setCreateAccountError(null);
    try {
      await register(payload);
    } catch (error) {
      setCreateAccountError(
        toUserFacingError(error, 'Unable to create your account. Try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setRecoveryError(null);
    setRecoveryToken(null);
    setCurrentStep('recovery-dob');
  };

  const handleVerifyRecovery = async (payload: { email: string; dateOfBirth: string }) => {
    setSubmittedEmail(payload.email);
    setIsSubmitting(true);
    setRecoveryError(null);
    try {
      const challenge = await verifyRecovery(payload.email, payload.dateOfBirth);
      setRecoveryToken(challenge.recoveryToken);
      setCurrentStep('recovery-password');
    } catch (error) {
      setRecoveryError(toUserFacingError(error, 'Unable to start password reset. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (password: string) => {
    if (!recoveryToken) {
      setRecoveryError('Start password reset again.');
      setCurrentStep('recovery-dob');
      return;
    }

    setIsSubmitting(true);
    setRecoveryError(null);
    try {
      await resetAccountPassword(recoveryToken, password);
      setPasswordError(null);
      setCurrentStep('password');
    } catch (error) {
      setRecoveryError(toUserFacingError(error, 'Unable to reset password. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPhoneCode = (code: string) => {
    onSubmitCode?.(code);
    setEmailSheetError(EMAIL_ONLY_AUTH_MESSAGE);
    setCurrentStep('email');
  };

  const isModalVisible = currentStep !== 'none';
  const showBackButton =
    currentStep === 'password' ||
    currentStep === 'create-account' ||
    currentStep === 'phone' ||
    currentStep === 'select-country' ||
    currentStep === 'recovery-dob' ||
    currentStep === 'recovery-password';

  const isCountryStep = currentStep === 'select-country' || activeStep === 'select-country';

  const renderStepContent = (step: AuthSheetStep) => {
    switch (step) {
      case 'email':
        return (
          <LoginOrSignUpContent
            key={`email-step-${sheetResetKey}`}
            initialEmail={submittedEmail}
            initialError={emailSheetError}
            onGooglePress={handleGoogleAuth}
            onApplePress={() => {
              onApplePress?.();
              handleUnsupportedAuth();
            }}
            onPhonePress={handlePhonePress}
            onSubmitEmail={handleSubmitEmail}
            onCreateAccountPress={handleCreateAccountPress}
          />
        );
      case 'phone':
        return (
          <EnterPhoneNumberContent
            key={`phone-step-${sheetResetKey}-${phoneResetKey}`}
            initialPhoneNumber={submittedPhoneNumber}
            selectedCountry={selectedCountry}
            onCountryPress={handleCountryPress}
            onSubmitPhoneNumber={handleSubmitPhoneNumber}
          />
        );
      case 'select-country':
        return (
          <CountryPickerContent
            key={`select-country-step-${sheetResetKey}`}
            selectedCountry={selectedCountry}
            onSelectCountry={(country) => {
              setSelectedCountry(country);
              setCurrentStep('phone');
            }}
          />
        );
      case 'password':
        return (
          <LoginPasswordContent
            key={`password-step-${sheetResetKey}-${passwordResetKey}`}
            email={submittedEmail}
            onEmailChange={setSubmittedEmail}
            onSubmitPassword={handleSubmitPassword}
            onForgotPassword={handleForgotPassword}
            onCreateAccountPress={handleCreateAccountPress}
            initialPasswordError={passwordError}
            isSubmitting={isSubmitting}
          />
        );
      case 'create-account':
        return (
          <CreateAccountContent
            key={`create-account-step-${sheetResetKey}-${passwordResetKey}`}
            email={submittedEmail}
            onEmailChange={setSubmittedEmail}
            onSubmitAccount={handleSubmitAccount}
            initialPasswordError={createAccountError}
            isSubmitting={isSubmitting}
          />
        );
      case 'recovery-dob':
        return (
          <RecoveryDobContent
            key={`recovery-dob-step-${sheetResetKey}`}
            email={submittedEmail}
            onEmailChange={setSubmittedEmail}
            onSubmit={handleVerifyRecovery}
            initialError={recoveryError}
            isSubmitting={isSubmitting}
          />
        );
      case 'recovery-password':
        return (
          <RecoveryPasswordContent
            key={`recovery-password-step-${sheetResetKey}`}
            onSubmit={handleResetPassword}
            initialError={recoveryError}
            isSubmitting={isSubmitting}
          />
        );
      case 'check-phone':
        return (
          <CheckPhoneContent
            key={`check-phone-step-${sheetResetKey}-${phoneResetKey}`}
            phoneNumber={submittedPhoneNumber}
            onSubmitCode={handleSubmitPhoneCode}
            onResendCode={onResendPhoneCode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]} testID="auth-screen">
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.headerContainer, { paddingTop }]} testID="auth-header-container">
        <AuthTypingHeader />
      </View>

      <View style={styles.sheetsContainer}>
        <AuthBottomSheet
          onApplePress={() => {
            onApplePress?.();
            handleUnsupportedAuth();
          }}
          onGooglePress={handleGoogleAuth}
          onLoginPress={handleLoginPress}
        />

        <ModalBottomSheet
          isVisible={isModalVisible}
          onClose={handleCloseSheet}
          showBackButton={showBackButton}
          onBackPress={handleBackToEmail}
          enableDragToClose={isCountryStep}
          disableScrollView={isCountryStep}
          requireCloseConfirmation={currentStep === 'check-phone'}
          closeConfirmationTitle="Leave Verification?"
          closeConfirmationMessage="Are you sure you want to leave verification?"
          confirmButtonText="Leave"
          cancelButtonText="Cancel"
          testID="auth-modal-bottom-sheet"
          closeButtonTestID={
            currentStep === 'check-phone'
              ? 'check-phone-sheet-close-button'
              : currentStep === 'create-account'
                ? 'create-account-sheet-close-button'
                : currentStep === 'password'
                  ? 'password-sheet-close-button'
                  : currentStep === 'phone'
                    ? 'phone-sheet-close-button'
                    : currentStep === 'select-country'
                      ? 'country-picker-close-button'
                      : currentStep === 'recovery-dob'
                        ? 'recovery-dob-close-button'
                        : currentStep === 'recovery-password'
                          ? 'recovery-password-close-button'
                          : 'auth-email-close-button'
          }
          backButtonTestID={
            currentStep === 'create-account'
              ? 'create-account-sheet-back-button'
              : currentStep === 'phone'
                ? 'phone-sheet-back-button'
                : currentStep === 'select-country'
                  ? 'country-picker-back-button'
                  : currentStep === 'recovery-dob'
                    ? 'recovery-dob-back-button'
                    : currentStep === 'recovery-password'
                      ? 'recovery-password-back-button'
                      : 'password-sheet-back-button'
          }
        >
          <View style={styles.staticLogoHeader}>
            <Image
              source={require('@/assets/images/auth/joy-icon.svg')}
              style={styles.joyIcon}
              contentFit="contain"
              accessibilityLabel="Joy Logo"
              testID="auth-joy-icon"
            />
          </View>
          <View style={styles.stepWrapper}>
            {activeStep !== 'none' && (
              <Animated.View
                style={[styles.stepContent, { opacity: contentOpacity }]}
                pointerEvents="auto"
              >
                {renderStepContent(activeStep)}
              </Animated.View>
            )}
          </View>
        </ModalBottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AuthTokens.colors.background,
    justifyContent: 'space-between',
  },
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetsContainer: {
    alignSelf: 'stretch',
  },
  staticLogoHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  joyIcon: {
    width: 64,
    height: 64,
  },
  stepWrapper: {
    position: 'relative',
    width: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  stepContent: {
    width: '100%',
    flex: 1,
  },
});
