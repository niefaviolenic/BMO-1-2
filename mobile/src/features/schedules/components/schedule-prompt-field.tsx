import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { ScheduleTokens, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SchedulePromptFieldProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SchedulePromptField({
  value = 'Recommend a few exciting things to do nearby this weekend, tailored to my interests in nature and hiking, a budget of Rp250k-750k, and the expected weather around my home.',
  onChangeText,
  placeholder = 'Enter prompt...',
  editable = true,
  style,
  testID = 'schedule-prompt-field',
}: SchedulePromptFieldProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline
        editable={editable}
        style={[styles.input, { color: theme.text }]}
        testID={`${testID}-input`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 362,
    minHeight: 118,
    borderRadius: ScheduleTokens.borderRadius.field,
    padding: 16,
    borderWidth: 1,
  },
  input: {
    fontSize: Typography.subheadline.fontSize,
    lineHeight: 20,
    fontWeight: '400',
    textAlignVertical: 'top',
  },
});
