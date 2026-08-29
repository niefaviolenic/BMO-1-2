import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ActiveJoyCapabilitiesCardTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ActiveJoyCapability = {
  id: string;
  title: string;
  description: string;
};

export type ActiveJoyCapabilitiesCardProps = {
  /** Ordered list of active capabilities. Defaults to the 3 Figma capabilities. */
  capabilities?: ActiveJoyCapability[];
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_CAPABILITIES: ActiveJoyCapability[] = [
  {
    id: 'robot-notifications',
    title: 'Robot Physical Notifications',
    description:
      "Display incoming notifications directly on Joy's physical device.",
  },
  {
    id: 'send-schedule',
    title: 'Send & Schedule Messages',
    description:
      'Send and schedule automated messages seamlessly from app or Joy.',
  },
  {
    id: 'realtime-sync',
    title: 'Real-time Message Sync',
    description:
      'Keep messages and notification statuses synced instantly across devices.',
  },
];

/**
 * ActiveJoyCapabilitiesCard
 *
 * Card listing active Joy capabilities after WhatsApp pairing succeeds
 * (Figma 611:134826). Green check badges + title/description rows.
 *
 * Width 354 · border-radius 16 · gap 14
 */
export function ActiveJoyCapabilitiesCard({
  capabilities = DEFAULT_CAPABILITIES,
  style,
  testID = 'active-joy-capabilities-card',
}: ActiveJoyCapabilitiesCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <Text style={[styles.header, { color: theme.textMuted }]} testID={`${testID}-header`}>
        ACTIVE JOY CAPABILITIES
      </Text>

      {capabilities.map((item) => (
        <View
          key={item.id}
          style={styles.row}
          testID={`${testID}-item-${item.id}`}
        >
          <View
            style={styles.badge}
            testID={`${testID}-item-${item.id}-badge`}
          >
            <Text style={styles.badgeText}>✓</Text>
          </View>

          <View style={styles.textBlock}>
            <Text
              style={[styles.itemTitle, { color: theme.text }]}
              numberOfLines={1}
              testID={`${testID}-item-${item.id}-title`}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.itemDescription, { color: theme.textSecondary }]}
              numberOfLines={2}
              testID={`${testID}-item-${item.id}-description`}
            >
              {item.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: Tokens.layout.width,
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.cardBorder,
    padding: Tokens.layout.padding,
    gap: Tokens.layout.gap,
  },
  header: {
    fontSize: Tokens.header.fontSize,
    fontWeight: Tokens.header.fontWeight,
    color: Tokens.colors.headerLabel,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Tokens.row.gap,
  },
  badge: {
    width: Tokens.badge.size,
    height: Tokens.badge.size,
    borderRadius: Tokens.badge.borderRadius,
    backgroundColor: Tokens.colors.badgeBackground,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: Tokens.badge.fontSize,
    fontWeight: Tokens.badge.fontWeight,
    color: Tokens.colors.badgeText,
    textAlign: 'center',
  },
  textBlock: {
    flex: 1,
    gap: Tokens.itemDescription.textGap,
  },
  itemTitle: {
    fontSize: Tokens.itemTitle.fontSize,
    fontWeight: Tokens.itemTitle.fontWeight,
    color: Tokens.colors.itemTitle,
  },
  itemDescription: {
    fontSize: Tokens.itemDescription.fontSize,
    fontWeight: Tokens.itemDescription.fontWeight,
    color: Tokens.colors.itemDescription,
  },
});
