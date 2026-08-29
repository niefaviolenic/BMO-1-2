import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type AnimatedDropdownOverlayProps = {
  /** Controls whether the dropdown popup is open */
  isOpen: boolean;
  /** Fired when backdrop is pressed or overlay requests closing */
  onClose: () => void;
  /** Content to render inside the animated container (e.g. DropdownMenu) */
  children: React.ReactNode;
  /** Custom backdrop style override */
  backdropStyle?: StyleProp<ViewStyle>;
  /** Custom dropdown container style override */
  containerStyle?: StyleProp<ViewStyle>;
  /** Test ID for automated testing */
  testID?: string;
};

export function AnimatedDropdownOverlay({
  isOpen,
  onClose,
  children,
  backdropStyle,
  containerStyle,
  testID = 'animated-dropdown-overlay',
}: AnimatedDropdownOverlayProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      opacity.stopAnimation();
      scale.stopAnimation();
      translateY.stopAnimation();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      opacity.stopAnimation();
      scale.stopAnimation();
      translateY.stopAnimation();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -6,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [isOpen, shouldRender, opacity, scale, translateY]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <Animated.View
        style={[styles.backdrop, { opacity }, backdropStyle]}
        testID={`${testID}-backdrop-container`}
      >
        <Pressable
          style={styles.pressableBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close options menu"
          testID={`${testID}-backdrop`}
        />
      </Animated.View>
      {/*
        Content uses transform-only animation. Opacity on this elevated/shadowed
        subtree causes Android compositing flicker (ghost rectangles during open/close).
        Backdrop above still fades via `opacity`.
      */}
      <Animated.View
        style={[
          styles.container,
          containerStyle,
          {
            transform: [{ translateY }, { scale }],
          },
        ]}
        testID={`${testID}-content`}
      >
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  pressableBackdrop: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    top: 52,
    right: 0,
    padding: 16,
    zIndex: 1000,
  },
});
