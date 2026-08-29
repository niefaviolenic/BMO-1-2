import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { ScheduleEditPillTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleEditPillProps = {
  scheduleText: string;
  titleText: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleEditPill({
  scheduleText,
  titleText,
  onPress,
  style,
  testID = 'schedule-edit-pill',
}: ScheduleEditPillProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${scheduleText}, ${titleText}`}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          { transform: [{ scale }] },
          style,
        ]}
      >
        <Text
          style={[styles.scheduleText, { color: theme.linkPrimary }]}
          numberOfLines={1}
          testID={`${testID}-schedule-text`}
        >
          {scheduleText}
        </Text>
        <Text style={[styles.dotText, { color: theme.textMuted }]}>·</Text>
        <Text
          style={[styles.titleText, { color: theme.text }]}
          numberOfLines={1}
          testID={`${testID}-title-text`}
        >
          {titleText}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: ScheduleEditPillTokens.height,
    borderRadius: ScheduleEditPillTokens.borderRadius,
    borderWidth: 1,
    paddingVertical: ScheduleEditPillTokens.paddingVertical,
    paddingHorizontal: ScheduleEditPillTokens.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ScheduleEditPillTokens.gap,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'flex-start',
  },
  scheduleText: {
    fontSize: ScheduleEditPillTokens.fontSize,
    fontWeight: '600',
  },
  dotText: {
    fontSize: ScheduleEditPillTokens.fontSize,
    fontWeight: '400',
  },
  titleText: {
    fontSize: ScheduleEditPillTokens.fontSize,
    fontWeight: '600',
  },
});
