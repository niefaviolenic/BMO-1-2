import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { DEFAULT_COUNTRY, Country } from '@/constants/countries';
import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CountryPickerModal } from '@/features/auth/components/country-picker-modal';

export function formatPhoneNumber(text: string): string {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 13)}`;
}

export type EnterPhoneNumberContentProps = {
  initialPhoneNumber?: string;
  initialError?: string | null;
  selectedCountry?: Country;
  onSubmitPhoneNumber?: (phoneNumber: string) => void;
  onCountryPress?: () => void;
};

export function EnterPhoneNumberContent({
  initialPhoneNumber = '',
  initialError = null,
  selectedCountry = DEFAULT_COUNTRY,
  onSubmitPhoneNumber,
  onCountryPress,
}: EnterPhoneNumberContentProps) {
  const theme = useTheme();
  const [phoneNumber, setPhoneNumber] = useState(() => formatPhoneNumber(initialPhoneNumber));
  const [error, setError] = useState<string | null>(initialError);
  const [isFocused, setIsFocused] = useState(false);
  const [isInternalPickerVisible, setIsInternalPickerVisible] = useState(false);
  const [internalSelectedCountry, setInternalSelectedCountry] = useState<Country>(selectedCountry);

  useEffect(() => {
    setPhoneNumber(formatPhoneNumber(initialPhoneNumber));
    setError(initialError);
  }, [initialPhoneNumber, initialError]);

  useEffect(() => {
    setInternalSelectedCountry(selectedCountry);
  }, [selectedCountry]);

  const handleCountrySelectorPress = () => {
    if (onCountryPress) {
      onCountryPress();
    } else {
      setIsInternalPickerVisible(true);
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    setPhoneNumber(formatPhoneNumber(text));
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = () => {
    Keyboard.dismiss();

    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setError('Please enter your phone number to continue.');
      return;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 6) {
      setError('Please enter a valid phone number.');
      return;
    }

    setError(null);
    onSubmitPhoneNumber?.(trimmed);
  };

  const isFilled = phoneNumber.trim().length > 0;
  const isInvalid = Boolean(error);
  const activeDialCode = internalSelectedCountry.dialCode;

  return (
    <View style={styles.contentColumn}>
      {/* Header Title & Subtitle */}
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="enter-phone-number-title">
          Enter your phone number
        </Text>
        <Text style={[styles.subtitleText, { color: theme.textSecondary }]} testID="enter-phone-number-subtitle">
          We’ll send you a verification code via SMS to confirm your device.
        </Text>
      </View>

      {/* Spacer 8px */}
      <View style={styles.spacer8} />

      {/* Phone Input Field with Country Selector */}
      <View style={styles.inputSection}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: isFocused ? theme.inputBorderActive : theme.inputBorder,
            },
            isFocused && styles.textInputWrapperFocused,
            isInvalid && styles.textInputWrapperError,
          ]}
        >
          {/* Country Selector */}
          <TouchableOpacity
            style={styles.countrySelector}
            onPress={handleCountrySelectorPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Country code ${activeDialCode}`}
            testID="country-selector"
          >
            <Text style={styles.flagText}>{internalSelectedCountry.flag}</Text>
            <Text style={[styles.countryCodeText, { color: theme.text }]}>{activeDialCode}</Text>
            <View style={styles.chevronContainer}>
              <Image source={require('@/assets/images/auth/chevron-down.svg')} style={styles.chevronIcon} contentFit="contain" />
            </View>
          </TouchableOpacity>

          {/* Vertical Divider */}
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          {/* Text Input Column */}
          <View style={styles.textColumn}>
            {isFilled && (
              <Text style={[styles.inputLabel, { color: theme.inputPlaceholder }]} testID="phone-input-label">
                Phone number
              </Text>
            )}
            <TextInput
              style={[styles.textInput, { color: theme.inputText }, isFilled && styles.textInputFilled]}
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isFilled ? undefined : 'Phone number'}
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="phone-pad"
              autoCorrect={false}
              selectTextOnFocus
              accessibilityLabel="Phone number"
              testID="phone-input"
            />
          </View>
        </View>

        {/* Error Message with Exclamation Icon */}
        {isInvalid && (
          <View style={styles.errorRow} testID="phone-error-container">
            <View style={styles.exclamationCircle}>
              <Text style={styles.exclamationMark}>!</Text>
            </View>
            <Text style={styles.errorText} testID="phone-error-text">
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
        testID="phone-continue-button"
      >
        <Text style={[styles.continueButtonText, { color: theme.buttonPrimaryText }]}>Continue</Text>
      </Pressable>

      {/* Flex Spacer */}
      <View style={styles.flexSpacer} />

      {/* Terms of Use & Privacy Policy Footer */}
      <Text style={[styles.footerText, { color: theme.textMuted }]} testID="enter-phone-number-footer">
        <Text style={[styles.footerLink, { color: theme.textSecondary }]} testID="terms-of-use-link">
          Terms of Use
        </Text>
        <Text>{'  •  '}</Text>
        <Text style={[styles.footerLink, { color: theme.textSecondary }]} testID="privacy-policy-link">
          Privacy Policy
        </Text>
      </Text>

      {/* Standalone / Internal Country Picker Modal */}
      <CountryPickerModal
        isVisible={isInternalPickerVisible}
        selectedCountry={internalSelectedCountry}
        onSelectCountry={(country) => {
          setInternalSelectedCountry(country);
          setIsInternalPickerVisible(false);
        }}
        onClose={() => setIsInternalPickerVisible(false)}
      />
    </View>
  );
}

export type EnterPhoneNumberSheetProps = EnterPhoneNumberContentProps & {
  isVisible: boolean;
  onBackPress: () => void;
  onClosePress: () => void;
};

export function EnterPhoneNumberSheet({
  isVisible,
  onBackPress,
  onClosePress,
  ...contentProps
}: EnterPhoneNumberSheetProps) {
  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClosePress}
      showBackButton={true}
      onBackPress={onBackPress}
      testID="enter-phone-number-modal"
      closeButtonTestID="phone-sheet-close-button"
      backButtonTestID="phone-sheet-back-button"
    >
      <EnterPhoneNumberContent {...contentProps} />
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  contentColumn: {
    flex: 1,
    gap: 16,
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
  textInputWrapperError: {
    borderColor: AuthTokens.colors.emailInputBorder,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
    zIndex: 10,
  },
  flagText: {
    fontSize: 16,
  },
  countryCodeText: {
    color: AuthTokens.colors.emailInputText,
    fontSize: AuthTokens.typography.inputText.fontSize,
    fontWeight: '500',
  },
  chevronContainer: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronIcon: {
    width: 12,
    height: 12,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: AuthTokens.colors.emailInputBorder,
    marginRight: 12,
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
