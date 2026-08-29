import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { RobotCodeInputCardTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RobotCodeInputCardProps = {
  /** Current 6-digit PIN or pairing code string. Defaults to "XMD892" if omitted. */
  code?: string;
  /** Callback fired when code changes via keyboard input. */
  onCodeChange?: (code: string) => void;
  /** Total number of code digits/characters required. Defaults to 6. */
  codeLength?: number;
  /** Automatically focus the hidden input on mount. Defaults to false. */
  autoFocus?: boolean;
  /** Whether input field is editable. Defaults to true. */
  editable?: boolean;
  /** Restrict input to digits 0-9. Defaults to false. */
  digitsOnly?: boolean;
  /** Whether the input is in an error state. Defaults to false. */
  isError?: boolean;
  /** Optional custom container style override. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_CODE = 'XMD892';

export function RobotCodeInputCard({
  code = DEFAULT_CODE,
  onCodeChange,
  codeLength = 6,
  autoFocus = false,
  editable = true,
  digitsOnly = false,
  isError = false,
  style,
  testID = 'robot-code-input-card',
}: RobotCodeInputCardProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(autoFocus);

  const formattedCode = digitsOnly ? (code ?? '') : (code ?? '').toUpperCase();
  const digits = Array.from({ length: codeLength }, (_, i) => formattedCode[i] ?? '');

  const handlePress = () => {
    if (editable) {
      inputRef.current?.focus();
    }
  };

  const handleChangeText = (text: string) => {
    const sanitized = digitsOnly
      ? text.replace(/\D/g, '').slice(0, codeLength)
      : text
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, codeLength);
    onCodeChange?.(sanitized);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="text"
      accessibilityLabel={`Pairing code input${isError ? ' (error)' : ''}: ${formattedCode.split('').join(' ')}`}
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: isError ? Tokens.colors.cardBorderError : theme.border,
        },
        isError && styles.cardError,
        style,
      ]}
      testID={testID}
    >
      <TextInput
        ref={inputRef}
        value={formattedCode}
        onChangeText={handleChangeText}
        maxLength={codeLength}
        keyboardType={digitsOnly ? 'number-pad' : 'ascii-capable'}
        autoCapitalize={digitsOnly ? 'none' : 'characters'}
        autoCorrect={false}
        autoFocus={autoFocus}
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        testID={`${testID}-hidden-input`}
        caretHidden
      />

      <View style={styles.codeRow} testID={`${testID}-code-row`}>
        {digits.map((digit, index) => {
          const isFilled = digit.length > 0;
          const isActive =
            isFocused &&
            (index === formattedCode.length ||
              (formattedCode.length === codeLength && index === codeLength - 1));

          return (
            <View
              key={index}
              style={[
                styles.digitBox,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: isActive
                    ? theme.inputBorderActive
                    : isError
                      ? Tokens.colors.boxBorderError
                      : theme.border,
                },
                isActive && styles.digitBoxActive,
                isError && styles.digitBoxError,
              ]}
              testID={`${testID}-digit-box-${index}`}
            >
              {isFilled ? (
                <Text style={[styles.digitText, { color: theme.text }]} testID={`${testID}-digit-text-${index}`}>
                  {digit}
                </Text>
              ) : isActive ? (
                <View style={[styles.cursor, { backgroundColor: theme.text }]} testID={`${testID}-cursor-${index}`} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: Tokens.layout.width,
    height: Tokens.layout.height,
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: Tokens.layout.borderWidth,
    borderColor: Tokens.colors.cardBorder,
    paddingVertical: Tokens.layout.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardError: {
    borderColor: Tokens.colors.cardBorderError,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Tokens.layout.boxGap,
  },
  digitBox: {
    width: Tokens.layout.boxWidth,
    height: Tokens.layout.boxHeight,
    backgroundColor: Tokens.colors.boxBackground,
    borderRadius: Tokens.layout.boxBorderRadius,
    borderWidth: Tokens.layout.boxBorderWidthInactive,
    borderColor: Tokens.colors.boxBorderInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBoxActive: {
    borderWidth: Tokens.layout.boxBorderWidthActive,
    borderColor: Tokens.colors.boxBorderActive,
  },
  digitBoxError: {
    borderColor: Tokens.colors.boxBorderError,
  },
  digitText: {
    fontSize: Tokens.typography.digit.fontSize,
    fontWeight: Tokens.typography.digit.fontWeight,
    lineHeight: Tokens.typography.digit.lineHeight,
    color: Tokens.colors.textColor,
    textAlign: 'center',
  },
  cursor: {
    width: Tokens.layout.cursorWidth,
    height: Tokens.layout.cursorHeight,
    backgroundColor: Tokens.colors.cursorColor,
    borderRadius: Tokens.layout.cursorRadius,
  },
});
