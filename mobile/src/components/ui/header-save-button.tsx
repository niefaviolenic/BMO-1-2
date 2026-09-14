import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { HeaderTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassIconButton } from './liquid-glass-icon-button';

export type HeaderSaveButtonProps = {
  label?: string;
  onPress?: () => void;
  variant?: 'white' | 'dark' | 'blue';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function HeaderSaveButton({
  label = 'Save',
  onPress,
  variant = 'blue',
  disabled = false,
  loading = false,
  style,
  textStyle,
  testID = 'header-save-button',
}: HeaderSaveButtonProps) {
  const theme = useTheme();
  const isDark = variant === 'dark';
  const isBlue = variant === 'blue';
  const isDisabled = disabled || loading;

  const backgroundColor = isBlue
    ? (theme?.accentPrimary ?? theme?.linkPrimary ?? HeaderTokens.saveButton.backgroundBlue)
    : isDark
    ? HeaderTokens.saveButton.backgroundDark
    : HeaderTokens.saveButton.backgroundWhite;
  const textColor = isBlue
    ? HeaderTokens.saveButton.textBlue
    : isDark
    ? HeaderTokens.saveButton.textDark
    : HeaderTokens.saveButton.textWhite;
  return (
    <LiquidGlassIconButton
      onPress={isDisabled ? undefined : onPress}
      fitContent
      height={HeaderTokens.saveButton.height}
      borderRadius={HeaderTokens.saveButton.borderRadius}
      backgroundColor={backgroundColor}
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.container,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={textColor}
          testID={`${testID}-spinner`}
        />
      ) : (
        <Text
          style={[
            styles.label,
            isBlue
              ? styles.labelBlue
              : isDark
              ? styles.labelDark
              : styles.labelWhite,
            textStyle,
          ]}
          testID={`${testID}-text`}
        >
          {label}
        </Text>
      )}
    </LiquidGlassIconButton>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: HeaderTokens.saveButton.minWidth,
    paddingHorizontal: HeaderTokens.saveButton.paddingHorizontal,
    paddingVertical: HeaderTokens.saveButton.paddingVertical,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: HeaderTokens.saveButton.fontSize,
    fontWeight: HeaderTokens.saveButton.fontWeight,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    ...Platform.select({
      android: {
        top: -1.5,
      },
    }),
  },
  labelWhite: {
    color: HeaderTokens.saveButton.textWhite,
  },
  labelDark: {
    color: HeaderTokens.saveButton.textDark,
  },
  labelBlue: {
    color: HeaderTokens.saveButton.textBlue,
  },
});
