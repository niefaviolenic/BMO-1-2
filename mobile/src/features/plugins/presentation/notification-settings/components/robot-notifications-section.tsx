import { Bell } from 'lucide-react-native';
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

export interface RobotNotificationsSectionProps {
  /** Section header label above the card. Defaults to "Physical Device & AI Channels". */
  sectionTitle?: string;
  /** Info banner card title. Defaults to "Joy Channel & Device Alerts". */
  cardTitle?: string;
  /** Info banner description text. Defaults to "Select a connected channel below to manage physical robot voice alerts, daily task briefings, and AI reminders.". */
  description?: string;
  /** Optional press handler for the info banner card. */
  onPressCard?: () => void;
  /** Style override for the outer section container. */
  style?: StyleProp<ViewStyle>;
  /** Test ID identifier. */
  testID?: string;
}

export const RobotNotificationsSectionTokens = {
  layout: {
    width: 370,
    cardHeight: 92,
    cardRadius: 16,
    cardPaddingHorizontal: 16,
    cardPaddingVertical: 14,
    gapHeaderToCard: 6,
    gapIconToText: 12,
    iconBoxSize: 40,
    iconBoxRadius: 12,
    iconSize: 20,
    textGap: 3,
  },
  colors: {
    sectionTitle: '#737380',
    cardBackground: '#FFFFFF',
    cardBorder: '#E3E8F0',
    iconBoxBackground: '#F1F5F9',
    cardTitle: '#0F1729',
    cardDescription: '#80808C',
  },
  typography: {
    sectionTitle: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
    },
    cardDescription: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
  },
} as const;

export function RobotNotificationsSection({
  sectionTitle = 'Physical Device & AI Channels',
  cardTitle = 'Joy Channel & Device Alerts',
  description = 'Select a connected channel below to manage physical robot voice alerts, daily task briefings, and AI reminders.',
  onPressCard,
  style,
  testID = 'robot-notifications-section',
}: RobotNotificationsSectionProps) {
  const theme = useTheme();

  const cardContent = (
    <>
      <View
        style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}
        testID={`${testID}-icon-box`}
      >
        <Bell
          size={RobotNotificationsSectionTokens.layout.iconSize}
          color={theme.icon}
          strokeWidth={1.5}
          testID={`${testID}-bell-icon`}
        />
      </View>

      <View style={styles.textColumn} testID={`${testID}-text-column`}>
        <Text
          style={[styles.cardTitleText, { color: theme.textTitle }]}
          numberOfLines={1}
          testID={`${testID}-card-title`}
        >
          {cardTitle}
        </Text>
        <Text
          style={[styles.descriptionText, { color: theme.textSecondary }]}
          testID={`${testID}-card-description`}
        >
          {description}
        </Text>
      </View>
    </>
  );

  return (
    <View style={[styles.sectionContainer, style]} testID={testID}>
      {Boolean(sectionTitle) && (
        <Text
          style={[styles.sectionTitleText, { color: theme.textSecondary }]}
          testID={`${testID}-section-title`}
        >
          {sectionTitle}
        </Text>
      )}

      {onPressCard ? (
        <Pressable
          style={({ pressed }) => [
            styles.cardContainer,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
          onPress={onPressCard}
          testID={`${testID}-card`}
          accessibilityRole="button"
        >
          {cardContent}
        </Pressable>
      ) : (
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          testID={`${testID}-card`}
        >
          {cardContent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    width: RobotNotificationsSectionTokens.layout.width,
    maxWidth: '100%',
    gap: RobotNotificationsSectionTokens.layout.gapHeaderToCard,
    alignItems: 'flex-start',
  },
  sectionTitleText: {
    fontSize: RobotNotificationsSectionTokens.typography.sectionTitle.fontSize,
    fontWeight: RobotNotificationsSectionTokens.typography.sectionTitle.fontWeight,
    lineHeight: RobotNotificationsSectionTokens.typography.sectionTitle.lineHeight,
    color: RobotNotificationsSectionTokens.colors.sectionTitle,
  },
  cardContainer: {
    width: RobotNotificationsSectionTokens.layout.width,
    maxWidth: '100%',
    height: RobotNotificationsSectionTokens.layout.cardHeight,
    backgroundColor: RobotNotificationsSectionTokens.colors.cardBackground,
    borderRadius: RobotNotificationsSectionTokens.layout.cardRadius,
    borderWidth: 1,
    borderColor: RobotNotificationsSectionTokens.colors.cardBorder,
    paddingHorizontal: RobotNotificationsSectionTokens.layout.cardPaddingHorizontal,
    paddingVertical: RobotNotificationsSectionTokens.layout.cardPaddingVertical,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RobotNotificationsSectionTokens.layout.gapIconToText,
  },
  pressed: {
    opacity: 0.8,
  },
  iconBox: {
    width: RobotNotificationsSectionTokens.layout.iconBoxSize,
    height: RobotNotificationsSectionTokens.layout.iconBoxSize,
    borderRadius: RobotNotificationsSectionTokens.layout.iconBoxRadius,
    backgroundColor: RobotNotificationsSectionTokens.colors.iconBoxBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: RobotNotificationsSectionTokens.layout.textGap,
  },
  cardTitleText: {
    fontSize: RobotNotificationsSectionTokens.typography.cardTitle.fontSize,
    fontWeight: RobotNotificationsSectionTokens.typography.cardTitle.fontWeight,
    lineHeight: RobotNotificationsSectionTokens.typography.cardTitle.lineHeight,
    color: RobotNotificationsSectionTokens.colors.cardTitle,
  },
  descriptionText: {
    fontSize: RobotNotificationsSectionTokens.typography.cardDescription.fontSize,
    fontWeight: RobotNotificationsSectionTokens.typography.cardDescription.fontWeight,
    lineHeight: RobotNotificationsSectionTokens.typography.cardDescription.lineHeight,
    color: RobotNotificationsSectionTokens.colors.cardDescription,
  },
});
