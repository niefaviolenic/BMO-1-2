import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PairingInstructionsCardTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PairingStep = {
  step: number;
  title: string;
  description: string;
};

export type PairingInstructionsCardProps = {
  /** Ordered list of pairing steps to render. Defaults to the 3 standard WhatsApp linking steps. */
  steps?: PairingStep[];
  /** Section header label above the steps. Defaults to "LINKING INSTRUCTIONS". */
  headerLabel?: string;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_STEPS: PairingStep[] = [
  {
    step: 1,
    title: 'Enter Phone Number',
    description: 'Type your WhatsApp number & tap Get Pairing Code.',
  },
  {
    step: 2,
    title: 'Open WhatsApp App',
    description: 'Go to Settings > Linked Devices on your mobile device.',
  },
  {
    step: 3,
    title: 'Enter 8-Digit Code',
    description: "Select 'Link with phone number instead' & type the code.",
  },
];

export function PairingInstructionsCard({
  steps = DEFAULT_STEPS,
  headerLabel = 'LINKING INSTRUCTIONS',
  style,
  testID = 'pairing-instructions-card',
}: PairingInstructionsCardProps) {
  const theme = useTheme();

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
      <Text style={[styles.header, { color: theme.textMuted }]} testID={`${testID}-header`}>
        {headerLabel}
      </Text>

      {steps.map((item) => (
        <View
          key={item.step}
          style={styles.row}
          testID={`${testID}-step-${item.step}`}
        >
          {/* Number badge */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
            testID={`${testID}-step-${item.step}-badge`}
          >
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{item.step}</Text>
          </View>

          {/* Step text */}
          <View style={styles.textBlock}>
            <Text
              style={[styles.stepTitle, { color: theme.text }]}
              numberOfLines={1}
              testID={`${testID}-step-${item.step}-title`}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.stepDescription, { color: theme.textSecondary }]}
              numberOfLines={2}
              testID={`${testID}-step-${item.step}-description`}
            >
              {item.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: Tokens.layout.width,
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.cardBorder,
    padding: Tokens.layout.padding,
    gap: Tokens.layout.gap,
  },
  header: {
    fontSize: Tokens.header.fontSize,
    fontWeight: Tokens.header.fontWeight,
    color: Tokens.colors.headerLabel,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Tokens.row.gap,
  },
  badge: {
    width: Tokens.badge.size,
    height: Tokens.badge.size,
    borderRadius: Tokens.badge.borderRadius,
    backgroundColor: Tokens.colors.badgeBackground,
    borderWidth: 1,
    borderColor: Tokens.colors.badgeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: Tokens.badge.fontSize,
    fontWeight: Tokens.badge.fontWeight,
    color: Tokens.colors.badgeText,
    textAlign: 'center',
  },
  textBlock: {
    flex: 1,
    gap: Tokens.stepDescription.textGap,
  },
  stepTitle: {
    fontSize: Tokens.stepTitle.fontSize,
    fontWeight: Tokens.stepTitle.fontWeight,
    color: Tokens.colors.stepTitle,
  },
  stepDescription: {
    fontSize: Tokens.stepDescription.fontSize,
    fontWeight: Tokens.stepDescription.fontWeight,
    color: Tokens.colors.stepDescription,
  },
});
