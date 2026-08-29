import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

export type BugReportTextareaCardProps = Omit<
  TextInputProps,
  'style' | 'value' | 'onChangeText'
> & {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function BugReportTextareaCard({
  label = 'What happened?',
  value = '',
  onChangeText,
  placeholder = 'Tell us about the issue you encountered',
  maxLength = SettingsTokens.bugReportTextareaCard.defaultMaxLength,
  editable = true,
  style,
  inputStyle,
  testID = 'bug-report-textarea-card',
  ...rest
}: BugReportTextareaCardProps) {
  const theme = useTheme();
  const currentLength = value ? value.length : 0;

  return (
    <View style={[styles.wrapper, style]} testID={testID}>
      {Boolean(label) && (
        <Text style={[styles.label, { color: theme.textSecondary }]} testID={`${testID}-label`}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-card`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          editable={editable}
          maxLength={maxLength}
          multiline
          textAlignVertical="top"
          style={[styles.input, { color: theme.text }, inputStyle]}
          accessibilityLabel={label || placeholder}
          testID={`${testID}-input`}
          {...rest}
        />

        <Text style={[styles.counterText, { color: theme.textMuted }]} testID={`${testID}-counter`}>
          {`${currentLength} / ${maxLength}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: SettingsTokens.bugReportTextareaCard.width,
    gap: SettingsTokens.bugReportTextareaCard.labelSpacing,
  },
  label: {
    fontSize: SettingsTokens.bugReportTextareaCard.labelFontSize,
    lineHeight: SettingsTokens.bugReportTextareaCard.labelLineHeight,
    fontWeight: '600',
    color: SettingsTokens.bugReportTextareaCard.labelColor,
  },
  cardContainer: {
    width: '100%',
    height: SettingsTokens.bugReportTextareaCard.height,
    backgroundColor: SettingsTokens.bugReportTextareaCard.backgroundColor,
    borderRadius: SettingsTokens.bugReportTextareaCard.borderRadius,
    padding: SettingsTokens.bugReportTextareaCard.padding,
    justifyContent: 'space-between',
    gap: SettingsTokens.bugReportTextareaCard.itemSpacing,
  },
  input: {
    flex: 1,
    fontSize: SettingsTokens.bugReportTextareaCard.inputFontSize,
    lineHeight: SettingsTokens.bugReportTextareaCard.inputLineHeight,
    fontWeight: '400',
    color: SettingsTokens.bugReportTextareaCard.textColor,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  counterText: {
    fontSize: SettingsTokens.bugReportTextareaCard.counterFontSize,
    lineHeight: SettingsTokens.bugReportTextareaCard.counterLineHeight,
    fontWeight: '400',
    color: SettingsTokens.bugReportTextareaCard.counterColor,
    textAlign: 'right',
  },
});
