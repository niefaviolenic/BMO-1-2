import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatTokens } from '@/constants/theme';

export type PromptSuggestionItemProps = {
  label: string;
  icon?: ImageSource;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PromptSuggestionItem({
  label,
  icon,
  onPress,
  style,
  testID = 'prompt-suggestion-item',
}: PromptSuggestionItemProps) {
  const theme = useTheme();
  const defaultIcon = require('@/assets/images/chat/sparkle-icon.svg');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={styles.iconContainer}>
        <Image
          source={icon ?? defaultIcon}
          style={styles.icon}
          tintColor={theme.text}
          contentFit="contain"
        />
      </View>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: ChatTokens.promptItem.paddingVertical,
    gap: ChatTokens.promptItem.gap,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: ChatTokens.promptItem.iconSize,
    height: ChatTokens.promptItem.iconSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: ChatTokens.promptItem.iconSize,
    height: ChatTokens.promptItem.iconSize,
  },
  label: {
    fontSize: ChatTokens.promptItem.fontSize,
    lineHeight: ChatTokens.promptItem.lineHeight,
    fontWeight: '400',
  },
});
