import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { BadgeTokens } from '@/constants/theme';

export type UnreadBadgeProps = {
  count: number | string;
  maxCount?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function UnreadBadge({
  count,
  maxCount = 99,
  style,
  testID = 'unread-badge',
}: UnreadBadgeProps) {
  let displayCount: string;
  if (typeof count === 'number') {
    displayCount = count > maxCount ? `${maxCount}+` : `${count}`;
  } else {
    displayCount = count;
  }

  const isWide = displayCount.length > 2;

  return (
    <View
      style={[
        styles.badge,
        isWide && styles.wideBadge,
        style,
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`${displayCount} unread items`}
    >
      <Text style={styles.text} numberOfLines={1}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: BadgeTokens.size,
    height: BadgeTokens.size,
    borderRadius: BadgeTokens.borderRadius,
    backgroundColor: BadgeTokens.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  wideBadge: {
    borderRadius: BadgeTokens.borderRadius,
    paddingHorizontal: 6,
  },
  text: {
    color: BadgeTokens.text,
    fontSize: BadgeTokens.fontSize,
    lineHeight: BadgeTokens.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
});
