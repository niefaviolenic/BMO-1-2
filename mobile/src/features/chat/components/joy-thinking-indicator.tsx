import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ChatTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type JoyThinkingIndicatorProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function ThinkingDot({ delayMs, reduceMotion, dotColor }: { delayMs: number; reduceMotion: boolean; dotColor: string }) {
  const progress = useRef(new Animated.Value(reduceMotion ? 0.45 : 0.28)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0.45);
      return;
    }

    progress.setValue(0.28);
    let loop: Animated.CompositeAnimation | null = null;
    const startTimer = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: ChatTokens.thinking.pulseDuration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 0.28,
            duration: ChatTokens.thinking.pulseDuration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    }, delayMs);

    return () => {
      clearTimeout(startTimer);
      loop?.stop();
    };
  }, [delayMs, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: dotColor,
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0.28, 1],
                outputRange: [0.72, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export function JoyThinkingIndicator({
  style,
  testID = 'joy-thinking-indicator',
}: JoyThinkingIndicatorProps) {
  const theme = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const stages = ChatTokens.thinking.stages;
  const [stageIndex, setStageIndex] = useState(0);
  const labelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const apply = (enabled: boolean) => setReduceMotion(enabled);
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (stages.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1 < stages.length ? prev + 1 : prev));
    }, ChatTokens.thinking.stageInterval);

    return () => {
      clearInterval(timer);
    };
  }, [stages.length]);

  useEffect(() => {
    if (stageIndex === 0 || reduceMotion) {
      return;
    }
    labelOpacity.setValue(0);
    const animation = Animated.timing(labelOpacity, {
      toValue: 1,
      duration: ChatTokens.thinking.fadeDuration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [stageIndex, reduceMotion, labelOpacity]);

  const displayLabel = stages[stageIndex] ?? ChatTokens.thinking.label;

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={displayLabel}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <View style={styles.dots} testID={`${testID}-dots`}>
        {[0, 1, 2].map((index) => (
          <ThinkingDot
            key={index}
            delayMs={index * ChatTokens.thinking.staggerDelay}
            reduceMotion={reduceMotion}
            dotColor={theme.iconMuted}
          />
        ))}
      </View>
      <Animated.Text
        style={[
          styles.label,
          { color: theme.textSecondary, opacity: reduceMotion ? 1 : labelOpacity },
        ]}
        testID={`${testID}-label`}
      >
        {displayLabel}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: ChatTokens.thinking.gap,
    width: '100%',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ChatTokens.thinking.dotsGap,
  },
  dot: {
    width: ChatTokens.thinking.dotSize,
    height: ChatTokens.thinking.dotSize,
    borderRadius: ChatTokens.thinking.dotSize / 2,
  },
  label: {
    fontSize: ChatTokens.thinking.labelFontSize,
    lineHeight: ChatTokens.thinking.labelLineHeight,
    fontWeight: '400',
  },
});
