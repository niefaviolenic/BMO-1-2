import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

export type OccupationCardContainerProps = Omit<
  TextInputProps,
  'style' | 'value' | 'onChangeText'
> & {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function OccupationCardContainer({
  value,
  onChangeText,
  placeholder = 'Engineer, student, etc.',
  editable = true,
  onPress,
  style,
  testID = 'occupation-card-container',
  ...rest
}: OccupationCardContainerProps) {
  const theme = useTheme();

  const inputContent = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      editable={editable && !onPress}
      style={[styles.input, { color: theme.text }]}
      accessibilityLabel={placeholder}
      testID={`${testID}-input`}
      {...rest}
    />
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          pressed && styles.pressed,
          style,
        ]}
        testID={testID}
      >
        <View pointerEvents="none" style={styles.innerView}>
          {inputContent}
        </View>
      </Pressable>
    );
  }

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
      {inputContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SettingsTokens.occupationCard.height,
    width: '100%',
    maxWidth: SettingsTokens.occupationCard.width,
    backgroundColor: SettingsTokens.occupationCard.backgroundColor,
    borderRadius: SettingsTokens.occupationCard.borderRadius,
    borderWidth: SettingsTokens.occupationCard.borderWidth,
    borderColor: SettingsTokens.occupationCard.borderColor,
    paddingHorizontal: SettingsTokens.occupationCard.paddingHorizontal,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerView: {
    width: '100%',
    justifyContent: 'center',
  },
  input: {
    fontSize: SettingsTokens.occupationCard.fontSize,
    lineHeight: SettingsTokens.occupationCard.lineHeight,
    fontWeight: '400',
    color: SettingsTokens.occupationCard.textColor,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
