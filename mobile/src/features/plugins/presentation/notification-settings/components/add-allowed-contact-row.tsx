import { Plus } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View, Pressable, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
export interface AddAllowedContactRowProps {
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AddAllowedContactRowTokens = {
  layout: {
    width: 370,
    height: 44,
    paddingHorizontal: 16,
    gap: 10,
  },
  colors: {
    background: '#FFFFFF',
    textPrimary: '#007AFF',
    plusIcon: '#007AFF',
  },
} as const;

export function AddAllowedContactRow({
  label = 'Add Contact',
  onPress,
  style,
  testID = 'add-allowed-contact-row',
}: AddAllowedContactRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.cardBackground }, style]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <View style={styles.plusBox}>
        <Plus
          size={16}
          color={theme.linkPrimary}
          strokeWidth={2.5}
        />
      </View>
      <Text style={[styles.labelText, { color: theme.linkPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: AddAllowedContactRowTokens.layout.width,
    maxWidth: '100%',
    height: AddAllowedContactRowTokens.layout.height,
    backgroundColor: AddAllowedContactRowTokens.colors.background,
    paddingHorizontal: AddAllowedContactRowTokens.layout.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AddAllowedContactRowTokens.layout.gap,
  },
  plusBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 16,
    fontWeight: '700',
    color: AddAllowedContactRowTokens.colors.plusIcon,
    lineHeight: 20,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: AddAllowedContactRowTokens.colors.textPrimary,
  },
});
