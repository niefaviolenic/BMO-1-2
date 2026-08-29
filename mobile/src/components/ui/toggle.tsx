import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ToggleTokens } from '@/constants/theme';

export { ToggleTokens };

export type ToggleProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Toggle({
  value,
  onValueChange,
  disabled = false,
  style,
  testID = 'toggle',
}: ToggleProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: ToggleTokens.animation.duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [value, progress]);

  const thumbTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ToggleTokens.layout.thumbTravel],
  });

  const trackOffColor = isDark
    ? ToggleTokens.colors.trackOffDark
    : ToggleTokens.colors.trackOffLight;

  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          onValueChange?.(!value);
        }
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.track,
        {
          backgroundColor: value
            ? ToggleTokens.colors.trackOn
            : trackOffColor,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: thumbTranslateX }] }]}
        testID={`${testID}-thumb`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: ToggleTokens.layout.width,
    height: ToggleTokens.layout.height,
    borderRadius: ToggleTokens.layout.borderRadius,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: ToggleTokens.layout.thumbInset,
    left: ToggleTokens.layout.thumbInset,
    width: ToggleTokens.layout.thumbSize,
    height: ToggleTokens.layout.thumbSize,
    borderRadius: ToggleTokens.layout.thumbSize / 2,
    backgroundColor: ToggleTokens.colors.thumb,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});
