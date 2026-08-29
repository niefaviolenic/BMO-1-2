import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Toggle } from '@/components/ui/toggle';
export interface EnableIntegrationCardProps {
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  title?: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const EnableIntegrationCardTokens = {
  layout: {
    width: 370,
    minHeight: 82,
    borderRadius: 16,
    padding: 16,
  },
  colors: {
    cardBackground: '#FFFFFF',
    border: '#E3E8F0',
    title: '#0F1729',
    description: '#80808C',
  },
} as const;

export function EnableIntegrationCard({
  enabled = true,
  onToggle,
  title = 'Notify via Joy Robot',
  description = 'Joy Robot speaks & displays face animation when WhatsApp messages land.',
  style,
  testID,
}: EnableIntegrationCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.textColumn}>
        <Text style={[styles.titleText, { color: theme.textTitle }]}>{title}</Text>
        <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>{description}</Text>
      </View>

      <Toggle
        value={enabled}
        onValueChange={onToggle}
        testID={testID ? `${testID}-toggle` : 'enable-integration-toggle'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: EnableIntegrationCardTokens.layout.width,
    maxWidth: '100%',
    minHeight: EnableIntegrationCardTokens.layout.minHeight,
    backgroundColor: EnableIntegrationCardTokens.colors.cardBackground,
    borderRadius: EnableIntegrationCardTokens.layout.borderRadius,
    borderWidth: 1,
    borderColor: EnableIntegrationCardTokens.colors.border,
    padding: EnableIntegrationCardTokens.layout.padding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textColumn: {
    flex: 1,
    paddingRight: 12,
    gap: 4,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: EnableIntegrationCardTokens.colors.title,
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: '400',
    color: EnableIntegrationCardTokens.colors.description,
    lineHeight: 16,
  },
});
