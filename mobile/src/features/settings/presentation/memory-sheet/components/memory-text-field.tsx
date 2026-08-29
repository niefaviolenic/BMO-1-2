import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { OccupationCardContainer } from '@/features/settings/components/occupation-card-container';
import { SettingsTokens } from '@/constants/theme';

const tokens = SettingsTokens.memorySheet;

export type MemoryTextFieldProps = {
  label: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MemoryTextField({
  label,
  value,
  onChangeText,
  placeholder,
  style,
  testID = 'memory-text-field',
}: MemoryTextFieldProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, style]} testID={testID}>
      <View style={styles.titleFrame}>
        <Text
          style={[styles.title, { color: theme.textSecondary }]}
          testID={`${testID}-label`}
        >
          {label}
        </Text>
      </View>
      <OccupationCardContainer
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        testID={`${testID}-input`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: tokens.sectionTitleGap,
  },
  titleFrame: {
    width: '100%',
    paddingLeft: tokens.sectionTitlePaddingLeft,
  },
  title: {
    fontSize: tokens.sectionTitleFontSize,
    fontWeight: '400',
    color: tokens.sectionTitleColor,
  },
  input: {
    borderWidth: 0,
    maxWidth: '100%',
    borderRadius: tokens.fieldCardRadius,
  },
});
