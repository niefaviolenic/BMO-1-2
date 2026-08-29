import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Toggle } from '@/components/ui/toggle';
import { SettingsTokens } from '@/constants/theme';
const tokens = SettingsTokens.personalizationSheet;

export type FastAnswersSectionProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  label?: string;
  caption?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_CAPTION =
  "Joy can sometimes use its general knowledge to give fast, in-depth answers. These aren't personalized and don't use your memory.";

export function FastAnswersSection({
  value = true,
  onValueChange,
  label = 'Fast answers',
  caption = DEFAULT_CAPTION,
  style,
  testID = 'fast-answers-section',
}: FastAnswersSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, style]} testID={testID}>
      <View
        style={[styles.card, { backgroundColor: theme.cardBackground }]}
        testID={`${testID}-card`}
      >
        <Text
          style={[styles.label, { color: theme.text }]}
          numberOfLines={1}
          testID={`${testID}-label`}
        >
          {label}
        </Text>
        <Toggle
          value={value}
          onValueChange={onValueChange}
          testID={`${testID}-toggle`}
        />
      </View>
      <View style={styles.captionFrame}>
        <Text
          style={[styles.caption, { color: theme.textSecondary }]}
          testID={`${testID}-caption`}
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: tokens.fastAnswersSectionGap,
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.fastAnswersCardRadius,
    paddingHorizontal: tokens.fastAnswersCardPaddingHorizontal,
    paddingVertical: tokens.fastAnswersCardPaddingVertical,
    overflow: 'hidden',
  },
  label: {
    fontSize: SettingsTokens.styleToneRow.labelFontSize,
    fontWeight: '400',
    color: SettingsTokens.colors.textPrimary,
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
});
