import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AlertCircle, RefreshCw, X } from 'lucide-react-native';

import { RobotPairSheetTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PairErrorCardProps = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PairErrorCard({
  message,
  onRetry,
  onDismiss,
  style,
  testID = 'pair-error-card',
}: PairErrorCardProps) {
  const theme = useTheme();
  const errorColor = theme.badgeBackground || '#FF3B30';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: `${errorColor}12`,
          borderColor: `${errorColor}30`,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="alert"
    >
      <View style={styles.contentRow}>
        <AlertCircle size={18} color={errorColor} />
        <View style={styles.textContainer}>
          <Text
            style={[styles.errorText, { color: errorColor }]}
            testID={`${testID}-message`}
          >
            {message}
          </Text>
        </View>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error notification"
            testID={`${testID}-dismiss-btn`}
          >
            <X size={16} color={errorColor} />
          </Pressable>
        ) : null}
      </View>

      {onRetry ? (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: `${errorColor}20`,
              borderColor: `${errorColor}40`,
            },
            pressed && { opacity: 0.7 },
          ]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          testID={`${testID}-retry-btn`}
        >
          <RefreshCw size={12} color={errorColor} />
          <Text
            style={[styles.retryText, { color: errorColor }]}
          >
            Try Again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: Tokens.errorCard.borderRadius,
    borderWidth: 1,
    padding: Tokens.errorCard.padding,
    gap: Tokens.errorCard.gap,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textContainer: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
