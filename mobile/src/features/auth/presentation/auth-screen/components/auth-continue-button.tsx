import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type AuthContinueButtonProps = {
  onPress: () => void;
  loading?: boolean;
  testID: string;
  label?: string;
  loadingAccessibilityLabel?: string;
};

export function AuthContinueButton({
  onPress,
  loading = false,
  testID,
  label = 'Continue',
  loadingAccessibilityLabel = 'Loading',
}: AuthContinueButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.buttonPrimaryBackground },
        (pressed || loading) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingAccessibilityLabel : label}
      accessibilityState={{ disabled: loading, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={theme.buttonPrimaryText}
          testID={`${testID}-spinner`}
        />
      ) : (
        <Text style={[styles.label, { color: theme.buttonPrimaryText }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: AuthTokens.spacing.buttonHeight,
    backgroundColor: AuthTokens.colors.continueButtonBackground,
    borderRadius: AuthTokens.spacing.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  label: {
    color: AuthTokens.colors.continueButtonText,
    fontSize: AuthTokens.typography.buttonText.fontSize,
    fontWeight: AuthTokens.typography.buttonText.fontWeight,
    lineHeight: AuthTokens.typography.buttonText.lineHeight,
  },
  pressed: {
    opacity: 0.82,
  },
});
