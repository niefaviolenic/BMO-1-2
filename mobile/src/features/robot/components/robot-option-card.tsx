import { Image } from 'expo-image';
import { ChevronRight, Keyboard } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { RobotTokens } from '@/constants/theme';

export type RobotOptionCardProps = {
  /** Primary title text. Defaults to "I Already Have a Joy Robot". */
  title?: string;
  /** Secondary description text. Defaults to "Pair with 6-digit code". */
  description?: string;
  /** Custom left icon URI or source. Defaults to keyboard icon. */
  iconSource?: string;
  /** Optional custom left icon node. Overrides iconSource when provided. */
  leftIcon?: React.ReactNode;
  /** Optional custom trailing icon node. Defaults to chevron-right. */
  trailingIcon?: React.ReactNode;
  /** Callback fired when card is pressed. */
  onPress?: () => void;
  /** Custom style overrides for container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function RobotOptionCard({
  title = 'I Already Have a Joy Robot',
  description = 'Pair with 6-digit code',
  iconSource,
  leftIcon,
  trailingIcon,
  onPress,
  style,
  testID = 'robot-option-card',
}: RobotOptionCardProps) {
  const theme = useTheme();

  const resolvedLeftIcon =
    leftIcon ??
    (iconSource ? (
      <Image
        source={{ uri: iconSource }}
        style={styles.leftIcon}
        tintColor={theme.icon}
        contentFit="contain"
      />
    ) : (
      <Keyboard
        size={RobotTokens.optionCard.leftIconSize}
        color={theme.icon}
        strokeWidth={1.5}
      />
    ));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        pressed && [styles.cardPressed, { backgroundColor: theme.cardPressed }],
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${description}`}
      testID={testID}
    >
      <View style={styles.leftIconSlot} testID={`${testID}-left-icon`}>
        {resolvedLeftIcon}
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.titleText, { color: theme.text }]} testID={`${testID}-title`}>
          {title}
        </Text>
        <Text style={[styles.descriptionText, { color: theme.textSecondary }]} testID={`${testID}-description`}>
          {description}
        </Text>
      </View>

      <View style={styles.trailingIconSlot} testID={`${testID}-trailing-icon`}>
        {trailingIcon ?? (
          <ChevronRight
            size={RobotTokens.optionCard.chevronSize}
            color={theme.textMuted}
            strokeWidth={1.5}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: RobotTokens.optionCard.width,
    maxWidth: '100%',
    minHeight: RobotTokens.optionCard.height,
    borderRadius: RobotTokens.optionCard.borderRadius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: RobotTokens.optionCard.padding,
    gap: RobotTokens.optionCard.gap,
    shadowColor: RobotTokens.optionCard.shadowColor,
    shadowOffset: RobotTokens.optionCard.shadowOffset,
    shadowOpacity: RobotTokens.optionCard.shadowOpacity,
    shadowRadius: RobotTokens.optionCard.shadowRadius,
    elevation: RobotTokens.optionCard.elevation,
  },
  cardPressed: {
    opacity: 0.9,
  },
  leftIconSlot: {
    width: RobotTokens.optionCard.leftIconSize,
    height: RobotTokens.optionCard.leftIconSize,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  leftIcon: {
    width: RobotTokens.optionCard.leftIconSize,
    height: RobotTokens.optionCard.leftIconSize,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    gap: RobotTokens.optionCard.textGap,
  },
  titleText: {
    fontSize: RobotTokens.optionCard.typography.title.fontSize,
    fontWeight: RobotTokens.optionCard.typography.title.fontWeight,
    lineHeight: RobotTokens.optionCard.typography.title.lineHeight,
  },
  descriptionText: {
    fontSize: RobotTokens.optionCard.typography.description.fontSize,
    fontWeight: RobotTokens.optionCard.typography.description.fontWeight,
    lineHeight: RobotTokens.optionCard.typography.description.lineHeight,
  },
  trailingIconSlot: {
    width: RobotTokens.optionCard.chevronSize,
    height: RobotTokens.optionCard.chevronSize,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
