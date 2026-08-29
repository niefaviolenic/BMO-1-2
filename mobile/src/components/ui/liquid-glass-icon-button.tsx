import { ReactNode, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Insets,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
/**
 * Glass press control — keep these behaviors in sync when editing:
 * 1) Scale up on press; stay scaled while finger moves outside; reset only on lift.
 * 2) Fire onPress only if lift is inside the button area (cancel if outside).
 * 3) Hit-test with view-relative event.x/y (+ scalePad hitSlop), NOT absolute window coords
 *    (absolute + measureInWindow drifts under Modal/sheet and feels “center-only”).
 * 4) Use Gesture.Pan(minDistance:0) so it wins over parent sheet PanGestureHandler
 *    without NativeViewGestureHandler (that one resets scale when leaving the view).
 */

export type LiquidGlassIconButtonProps = {
  onPress?: () => void;
  children: ReactNode;
  size?: number;
  width?: number;
  height?: number;
  /** When true, width follows content/style (minWidth/padding) instead of fixed size. */
  fitContent?: boolean;
  borderRadius?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'header';
  testID?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | Insets;
  showShadow?: boolean;
  backgroundColor?: string;
  scaleTo?: number;
};

export function LiquidGlassIconButton({
  onPress,
  children,
  size = 40,
  width,
  height,
  fitContent = false,
  borderRadius: customBorderRadius,
  accessibilityLabel = 'Button',
  accessibilityRole = 'button',
  testID,
  style,
  hitSlop = 8,
  showShadow = true,
  backgroundColor,
  scaleTo = 1.62,
}: LiquidGlassIconButtonProps) {
  const theme = useTheme();
  const resolvedBg = backgroundColor ?? theme.glassButtonBackground;
  const scale = useRef(new Animated.Value(1)).current;
  const onPressRef = useRef(onPress);
  const scaleToRef = useRef(scaleTo);
  const layoutSizeRef = useRef({ width: 0, height: 0 });
  onPressRef.current = onPress;
  scaleToRef.current = scaleTo;

  const btnHeight = height ?? size;
  const btnWidth = fitContent ? undefined : (width ?? size);
  const btnBorderRadius = customBorderRadius ?? btnHeight / 2;

  // Extra slop so the pressed (scaled) visual rim still counts as inside the button.
  const scalePad = Math.ceil(((scaleTo - 1) * btnHeight) / 2);

  const hitInsets = useMemo(() => {
    if (typeof hitSlop === 'number') {
      return {
        top: hitSlop,
        bottom: hitSlop,
        left: hitSlop,
        right: hitSlop,
      };
    }
    return {
      top: hitSlop?.top ?? 0,
      bottom: hitSlop?.bottom ?? 0,
      left: hitSlop?.left ?? 0,
      right: hitSlop?.right ?? 0,
    };
  }, [hitSlop]);

  const gestureHitSlop = useMemo(
    () => ({
      top: hitInsets.top + scalePad,
      bottom: hitInsets.bottom + scalePad,
      left: hitInsets.left + scalePad,
      right: hitInsets.right + scalePad,
    }),
    [hitInsets, scalePad],
  );

  const gestureHitSlopRef = useRef(gestureHitSlop);
  gestureHitSlopRef.current = gestureHitSlop;

  const animateScale = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: 120,
      easing: toValue === 1 ? Easing.inOut(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handlePressBegin = () => {
    animateScale(scaleToRef.current);
  };

  // View-relative x/y → seluruh area button, bukan cuma titik tengah / absolute window coords.
  const handlePressFinalize = (x: number, y: number) => {
    animateScale(1);

    const hit = gestureHitSlopRef.current;
    const { width, height: layoutHeight } = layoutSizeRef.current;
    const areaWidth = width > 0 ? width : (btnWidth ?? btnHeight);
    const areaHeight = layoutHeight > 0 ? layoutHeight : btnHeight;

    const inside =
      x >= -hit.left &&
      x <= areaWidth + hit.right &&
      y >= -hit.top &&
      y <= areaHeight + hit.bottom;

    if (inside) {
      onPressRef.current?.();
    }
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
    layoutSizeRef.current = { width: layoutWidth, height: layoutHeight };
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .hitSlop(gestureHitSlop)
        // Stays active while finger moves outside; scale resets only on finalize/lift.
        .onBegin(() => {
          'worklet';
          runOnJS(handlePressBegin)();
        })
        .onFinalize((event) => {
          'worklet';
          runOnJS(handlePressFinalize)(event.x, event.y);
        }),
    [gestureHitSlop],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        onLayout={handleLayout}
        style={[
          styles.touchArea,
          fitContent ? styles.touchAreaFitContent : { width: btnWidth, height: btnHeight },
          fitContent && { minHeight: btnHeight },
        ]}
        accessible
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.buttonContainer,
            {
              height: btnHeight,
              borderRadius: btnBorderRadius,
              backgroundColor: resolvedBg,
              borderWidth: 1,
              borderColor: theme.glassButtonBorder,
              transform: [{ scale }],
            },
            !fitContent && { width: btnWidth },
            fitContent && styles.buttonFitContent,
            showShadow && styles.glassShadow,
            style,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchArea: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  touchAreaFitContent: {
    alignSelf: 'flex-start',
  },
  buttonFitContent: {
    alignSelf: 'center',
  },
  glassShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
});
