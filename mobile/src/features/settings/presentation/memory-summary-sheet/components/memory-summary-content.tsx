import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { MemorySummarySheetTokens } from '@/constants/theme';
import type { MemorySummarySection } from '@/features/settings/domain/memory/types';

const tokens = MemorySummarySheetTokens;

export type MemorySummaryContentProps = {
  sections: MemorySummarySection[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MemorySummaryContent({
  sections,
  style,
  testID = 'memory-summary-content',
}: MemorySummaryContentProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {sections.map((section) => (
        <View
          key={section.id}
          style={styles.section}
          testID={`${testID}-section-${section.id}`}
        >
          <Text style={[styles.title, { color: theme.textTitle }]} testID={`${testID}-title-${section.id}`}>
            {section.title}
          </Text>
          <Text style={[styles.body, { color: theme.text }]} testID={`${testID}-body-${section.id}`}>
            {section.body}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: tokens.sectionGap,
  },
  section: {
    width: '100%',
    gap: tokens.sectionTitleGap,
  },
  title: {
    fontSize: tokens.sectionTitleFont.fontSize,
    fontWeight: tokens.sectionTitleFont.fontWeight,
    color: tokens.sectionTitleFont.color,
  },
  body: {
    fontSize: tokens.sectionBodyFont.fontSize,
    fontWeight: tokens.sectionBodyFont.fontWeight,
    color: tokens.sectionBodyFont.color,
  },
});
