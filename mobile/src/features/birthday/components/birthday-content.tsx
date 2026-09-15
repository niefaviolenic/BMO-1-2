import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';

export type BirthdayContentProps = {
  testID?: string;
};

export function BirthdayContent({ testID = 'birthday-content' }: BirthdayContentProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerGroup} testID={`${testID}-header-group`}>
        <Text style={[styles.title, { color: theme.textTitle }]} testID={`${testID}-title`}>
          Happy Birthday Devira
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: WelcomeTokens.spacing.contentGap,
    alignSelf: 'stretch',
  },
  headerGroup: {
    gap: WelcomeTokens.spacing.headerGap,
    alignSelf: 'stretch',
  },
  title: {
    color: WelcomeTokens.colors.textPrimary,
    fontSize: WelcomeTokens.typography.headerTitle.fontSize,
    fontWeight: WelcomeTokens.typography.headerTitle.fontWeight,
    lineHeight: WelcomeTokens.typography.headerTitle.lineHeight,
  },
});
