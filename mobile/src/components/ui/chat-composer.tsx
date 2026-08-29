import { Image } from "expo-image";
import { useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { ChatTokens } from "@/constants/theme";

export type ChatComposerProps = Omit<TextInputProps, "style"> & {
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  sendDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ChatComposer({
  value = "",
  onChangeText,
  onSubmit,
  placeholder = "Ask Joy",
  disabled = false,
  sendDisabled = false,
  style,
  testID = "chat-composer",
  ...rest
}: ChatComposerProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isFilled = value.trim().length > 0;
  const isSendDisabled = disabled || sendDisabled || !isFilled;

  const handlePressIn = () => {
    if (isSendDisabled) return;
    Animated.timing(scale, {
      toValue: 0.92,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (isSendDisabled) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.composerBackground,
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
        placeholderTextColor={theme.composerPlaceholder}
        style={[styles.input, { color: theme.text }]}
        editable={!disabled}
        onSubmitEditing={isSendDisabled ? undefined : onSubmit}
        accessibilityLabel={placeholder}
        {...rest}
      />
      <Pressable
        onPress={onSubmit}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isSendDisabled}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        testID={`${testID}-send-button`}
      >
        <Animated.View
          style={[
            styles.sendButton,
            { backgroundColor: theme.backgroundSelected },
            isFilled &&
              !sendDisabled &&
              !disabled && {
                backgroundColor: theme.accentPrimary ?? theme.linkPrimary,
              },
            (disabled || sendDisabled) && styles.disabledSendButton,
            { transform: [{ scale }] },
          ]}
        >
          <Image
            source={require("@/assets/images/chat/arrow-up.svg")}
            style={styles.sendIcon}
            tintColor={
              isFilled && !sendDisabled && !disabled
                ? ChatTokens.composer.sendButtonIcon
                : theme.composerSendIconInactive
            }
            contentFit="contain"
            accessibilityLabel="Send"
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1,
    borderRadius: ChatTokens.composer.borderRadius,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 12,
    shadowColor: ChatTokens.composer.shadowColor,
    shadowOffset: ChatTokens.composer.shadowOffset,
    shadowOpacity: ChatTokens.composer.shadowOpacity,
    shadowRadius: ChatTokens.composer.shadowRadius,
    elevation: ChatTokens.composer.elevation,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  sendButton: {
    width: ChatTokens.composer.sendButtonSize,
    height: ChatTokens.composer.sendButtonSize,
    borderRadius: ChatTokens.composer.sendButtonRadius,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledSendButton: {
    opacity: 0.5,
  },
  sendIcon: {
    width: ChatTokens.composer.iconSize,
    height: ChatTokens.composer.iconSize,
  },
});
