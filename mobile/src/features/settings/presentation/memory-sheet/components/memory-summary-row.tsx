import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

const tokens = SettingsTokens.memorySheet;

export type MemorySummaryRowProps = {
  onPress?: () => void;
  onCustomInstructionsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const CAPTION_PREFIX =
  'View an overview of what Joy has learned about you. Use ';
const CAPTION_SUFFIX =
  " for information you'd like it to always keep in mind.";

export function MemorySummaryRow({
  onPress,
  onCustomInstructionsPress,
  style,
  testID = 'memory-summary-row',
}: MemorySummaryRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, style]} testID={testID}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Memory summary"
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.cardBackground },
          pressed && styles.cardPressed,
        ]}
        testID={`${testID}-card`}
      >
        <Text
          style={[styles.label, { color: theme.text }]}
          numberOfLines={1}
          testID={`${testID}-label`}
        >
          Memory summary
        </Text>
        <ChevronRight
          size={tokens.chevronSize}
          color={theme.textSecondary}
          strokeWidth={1.5}
          testID={`${testID}-chevron`}
        />
      </Pressable>
      <View style={styles.captionFrame}>
        <Text
          style={[styles.caption, { color: theme.textSecondary }]}
          testID={`${testID}-caption`}
        >
          {CAPTION_PREFIX}
          <Text
            style={[styles.link, { color: theme.linkPrimary }]}
            onPress={onCustomInstructionsPress}
            testID={`${testID}-custom-instructions`}
          >
            custom instructions
          </Text>
          {CAPTION_SUFFIX}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: tokens.sectionGap,
  },
  card: {
    width: '100%',
    minHeight: tokens.summaryRowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.summaryCardRadius,
    paddingHorizontal: tokens.summaryCardPaddingHorizontal,
    paddingVertical: tokens.summaryCardPaddingVertical,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: tokens.labelFontSize,
    fontWeight: '400',
    color: tokens.labelColor,
  },
  captionFrame: {
    width: '100%',
    paddingHorizontal: tokens.captionPaddingHorizontal,
  },
  caption: {
    fontSize: tokens.captionFontSize,
    fontWeight: '400',
    color: tokens.captionColor,
  },
  link: {
    fontSize: tokens.captionFontSize,
    fontWeight: '400',
    color: tokens.captionLinkColor,
  },
});
