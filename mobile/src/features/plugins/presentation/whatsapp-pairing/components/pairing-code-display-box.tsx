import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PairingCodeDisplayBoxTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type PairingCodeDisplayBoxProps = {
  /** 8-character pairing code, e.g. "8K2P9XLM". Displayed as "8K2P - 9XLM". */
  code?: string;
  /** Remaining seconds until the code expires. Renders as "EXPIRES IN MM:SS". */
  expiresInSeconds?: number;
  /** Called when the user taps the code box. */
  onCopy?: () => void;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_CODE = '8K2P9XLM';
const DEFAULT_EXPIRES_IN_SECONDS = 599; // 09:59

/**
 * Formats raw seconds into "MM:SS" string.
 */
function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(seconds, 0) / 60);
  const s = Math.max(seconds, 0) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Splits an 8-char code into two 4-char halves separated by " - ".
 * Falls back to the raw string if it isn't exactly 8 characters.
 */
function formatCode(raw: string): string {
  const stripped = raw.replace(/\s|-/g, '').toUpperCase();
  if (stripped.length === 8) {
    return `${stripped.slice(0, 4)} - ${stripped.slice(4)}`;
  }
  return raw;
}

/**
 * PairingCodeDisplayBox
 *
 * Card component showing the 8-digit WhatsApp pairing code with a countdown
 * timer badge. Dimensions: width 354, height 166.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │  PAIRING CODE          EXPIRES IN 09:59 │  ← header row
 *   │                                         │
 *   │           8K2P - 9XLM                   │  ← centered code box
 *   └─────────────────────────────────────────┘
 */
export function PairingCodeDisplayBox({
  code = DEFAULT_CODE,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
  onCopy,
  style,
  testID = 'pairing-code-display-box',
}: PairingCodeDisplayBoxProps) {
  const theme = useTheme();
  const formattedCode = useMemo(() => formatCode(code), [code]);
  const formattedTime = useMemo(
    () => formatTime(expiresInSeconds),
    [expiresInSeconds]
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.headerRow} testID={`${testID}-header-row`}>
        <Text
          style={[styles.headerLabel, { color: theme.textMuted }]}
          testID={`${testID}-header-label`}
          numberOfLines={1}
        >
          PAIRING CODE
        </Text>

        <View
          style={[
            styles.timerBadge,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          testID={`${testID}-timer-badge`}
        >
          <Text
            style={[styles.timerText, { color: theme.textSecondary }]}
            testID={`${testID}-timer-text`}
          >
            EXPIRES IN {formattedTime}
          </Text>
        </View>
      </View>

      <Pressable
        style={[
          styles.codeBox,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
        onPress={onCopy}
        disabled={!onCopy}
        accessibilityRole={onCopy ? 'button' : undefined}
        accessibilityLabel={`Pairing code ${formattedCode}${onCopy ? '. Tap to copy.' : ''}`}
        testID={`${testID}-code-box`}
      >
        <Text style={[styles.codeText, { color: theme.text }]} testID={`${testID}-code-text`}>
          {formattedCode}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Tokens.layout.width,
    maxWidth: '100%',
    height: Tokens.layout.height,
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.cardBorder,
    padding: Tokens.layout.padding,
    gap: Tokens.layout.gap,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Tokens.header.rowHeight,
  },
  headerLabel: {
    fontSize: Tokens.header.fontSize,
    fontWeight: Tokens.header.fontWeight,
    color: Tokens.colors.headerLabel,
    letterSpacing: 0.3,
  },
  timerBadge: {
    backgroundColor: Tokens.colors.timerBadgeBackground,
    borderRadius: Tokens.timerBadge.borderRadius,
    borderWidth: Tokens.timerBadge.borderWidth,
    borderColor: Tokens.colors.timerBadgeBorder,
    paddingHorizontal: Tokens.timerBadge.paddingHorizontal,
    paddingVertical: Tokens.timerBadge.paddingVertical,
    overflow: 'hidden',
  },
  timerText: {
    fontSize: Tokens.timerBadge.fontSize,
    fontWeight: Tokens.timerBadge.fontWeight,
    color: Tokens.colors.timerBadgeText,
  },
  codeBox: {
    width: Tokens.codeBox.width,
    maxWidth: '100%',
    height: Tokens.codeBox.height,
    backgroundColor: Tokens.colors.codeBoxBackground,
    borderRadius: Tokens.codeBox.borderRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.codeBoxBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Tokens.codeBox.paddingHorizontal,
    paddingVertical: Tokens.codeBox.paddingVertical,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  codeText: {
    fontSize: Tokens.codeBox.fontSize,
    fontWeight: Tokens.codeBox.fontWeight,
    color: Tokens.colors.codeText,
  },
});
