import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  DotMatrixPatternTokens,
  MemorySummarySheetTokens,
} from '@/constants/theme';

export type DotMatrixPatternProps = {
  /** Number of dot rows (default: 45) */
  rows?: number;
  /** Number of dot columns (default: 24) */
  cols?: number;
  /** Dot fill color (default: '#B2B2B8') */
  dotColor?: string;
  /** Pulse opacity flash animation */
  animated?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Optional children rendered on top of the matrix pattern */
  children?: React.ReactNode;
  /** Test identifier */
  testID?: string;
};

type DotSpec = {
  key: string;
  left: number;
  top: number;
  size: number;
  opacity: number;
};

export function DotMatrixPattern({
  rows = DotMatrixPatternTokens.rows,
  cols = DotMatrixPatternTokens.cols,
  dotColor = DotMatrixPatternTokens.dotColor,
  animated = false,
  style,
  children,
  testID = 'dot-matrix-pattern',
}: DotMatrixPatternProps) {
  const flash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) {
      flash.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, {
          toValue: MemorySummarySheetTokens.flashMinOpacity,
          duration: MemorySummarySheetTokens.flashDurationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: MemorySummarySheetTokens.flashMaxOpacity,
          duration: MemorySummarySheetTokens.flashDurationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [animated, flash]);

  const dots = useMemo(() => {
    const list: DotSpec[] = [];
    const {
      startX,
      startY,
      pitch,
      centerX,
      centerY,
      sigma,
      baseDotSize,
      maxDotSize,
      baseOpacity,
      maxOpacity,
    } = DotMatrixPatternTokens;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = startX + c * pitch + baseDotSize / 2;
        const cy = startY + r * pitch + baseDotSize / 2;
        const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
        const factor = Math.exp(-((dist / sigma) ** 2));

        const size = baseDotSize + (maxDotSize - baseDotSize) * factor;
        const opacity = baseOpacity + (maxOpacity - baseOpacity) * factor;
        const left = cx - size / 2;
        const top = cy - size / 2;

        list.push({
          key: `dot_${r}_${c}`,
          left,
          top,
          size,
          opacity,
        });
      }
    }

    return list;
  }, [rows, cols]);

  return (
    <Animated.View
      style={[styles.container, style, animated && { opacity: flash }]}
      testID={testID}
    >
      {dots.map((dot) => (
        <View
          key={dot.key}
          style={[
            styles.dot,
            {
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
              backgroundColor: dotColor,
              opacity: dot.opacity,
            },
          ]}
        />
      ))}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: DotMatrixPatternTokens.width,
    height: DotMatrixPatternTokens.height,
    position: 'relative',
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
  },
});
