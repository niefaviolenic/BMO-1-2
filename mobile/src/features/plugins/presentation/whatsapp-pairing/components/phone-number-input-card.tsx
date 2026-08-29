import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type PhoneNumberInputCardProps = {
  /** ISO dial code displayed in the country prefix area. Defaults to "+62". */
  countryCode?: string;
  /** Current phone number value shown in the text input. */
  phoneNumber?: string;
  /** Callback fired when the user edits the phone number field. */
  onChangePhoneNumber?: (text: string) => void;
  /** Custom style overrides for the outer card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PhoneNumberInputCard({
  countryCode = '+62',
  phoneNumber = '',
  onChangePhoneNumber,
  style,
  testID = 'phone-number-input-card',
}: PhoneNumberInputCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, style]} testID={testID}>
      {/* Header label */}
      <Text
        style={[styles.headerLabel, { color: theme.textSecondary }]}
        testID={`${testID}-header`}
        numberOfLines={1}
      >
        WhatsApp Phone Number
      </Text>

      {/* Input field */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-input-row`}
      >
        {/* Country code prefix */}
        <Text
          style={[styles.countryCode, { color: theme.text }]}
          testID={`${testID}-country-code`}
          numberOfLines={1}
        >
          {countryCode}
        </Text>

        {/* Vertical divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.border }]}
          testID={`${testID}-divider`}
        />

        {/* Phone number text input */}
        <TextInput
          style={[styles.phoneInput, { color: theme.text }]}
          value={phoneNumber}
          onChangeText={onChangePhoneNumber}
          placeholder="812 3456 7890"
          placeholderTextColor={theme.textMuted}
          keyboardType="phone-pad"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Phone number"
          testID={`${testID}-text-input`}
        />
      </View>

      {/* Footer note */}
      <Text
        style={[styles.footerNote, { color: theme.textMuted }]}
        testID={`${testID}-footer`}
        numberOfLines={1}
      >
        Official WhatsApp Multi-Device API • End-to-end encrypted
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 354,
    maxWidth: '100%',
    gap: 8,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  inputRow: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  divider: {
    width: 1,
    height: 22,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  footerNote: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
  },
});
