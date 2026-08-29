import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { UserAvatar } from '@/components/ui/user-avatar';
import { useTheme } from '@/hooks/use-theme';

export type ProfileHeroStatsHeaderProps = {
  /** Display name of the user. Defaults to "Alex Rivers". */
  name?: string;
  /** Plan status tag text. Defaults to "PRO". Set to empty string or null to hide tag. */
  planTag?: string;
  /** Subtitle text below the name row. Defaults to "42 Days Streak • Sigma". */
  streakSubtext?: string;
  /** Stat 1 total days label. Defaults to "941 Days". */
  totalDays?: string;
  /** Stat 2 relapses count. Defaults to 2 (or "2"). */
  relapses?: string | number;
  /** Stat 3 win rate percentage text. Defaults to "85%". */
  winRate?: string;
  /** Custom avatar image source or URI string. Defaults to initials avatar. */
  avatarSource?: string | number | null;
  /** Callback when pressing the user profile area. */
  onProfilePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * ProfileHeroStatsHeader (Figma node 242:2706)
 * Displays user profile avatar (matching node 296:5677 circular profile avatar),
 * name, PRO tag, streak subtext, and 3 key statistics (Total Days, Relapses, Win Rate).
 */
export function ProfileHeroStatsHeader({
  name = 'Alex Rivers',
  planTag = 'PRO',
  streakSubtext = '42 Days Streak • Sigma',
  totalDays = '941 Days',
  relapses = '2',
  winRate = '85%',
  avatarSource,
  onProfilePress,
  style,
  testID = 'profile-hero-stats-header',
}: ProfileHeroStatsHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Top User Profile Header Row */}
      <Pressable
        onPress={onProfilePress}
        disabled={!onProfilePress}
        accessibilityRole={onProfilePress ? 'button' : undefined}
        accessibilityLabel={`Profile header for ${name}`}
        style={({ pressed }) => [
          styles.userRow,
          pressed && onProfilePress && styles.pressed,
        ]}
        testID={`${testID}-user-row`}
      >
        <UserAvatar
          name={name}
          avatarUrl={avatarSource}
          size={52}
          radius={26}
          fontSize={18}
          testID={`${testID}-avatar`}
          accessibilityLabel={name}
        />

        <View style={styles.userInfoCol} testID={`${testID}-info-col`}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.nameText, { color: theme.text }]}
              numberOfLines={1}
              testID={`${testID}-name`}
            >
              {name}
            </Text>
            {Boolean(planTag) && (
              <View style={styles.planTag} testID={`${testID}-plan-tag`}>
                <Text style={styles.planTagText}>{planTag}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.streakSubtext, { color: theme.textSecondary }]}
            numberOfLines={1}
            testID={`${testID}-subtext`}
          >
            {streakSubtext}
          </Text>
        </View>
      </Pressable>

      {/* Bottom 3 Stat Columns */}
      <View style={styles.statsRow} testID={`${testID}-stats-row`}>
        <View
          style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}
          testID={`${testID}-stat-total-days`}
        >
          <Text style={[styles.statValueText, { color: theme.text }]}>{totalDays}</Text>
          <Text style={[styles.statLabelText, { color: theme.textMuted }]}>Total Days</Text>
        </View>

        <View
          style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}
          testID={`${testID}-stat-relapses`}
        >
          <Text style={[styles.statValueText, { color: theme.text }]}>{String(relapses)}</Text>
          <Text style={[styles.statLabelText, { color: theme.textMuted }]}>Relapses</Text>
        </View>

        <View
          style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}
          testID={`${testID}-stat-win-rate`}
        >
          <Text style={[styles.statValueText, { color: theme.text }]}>{winRate}</Text>
          <Text style={[styles.statLabelText, { color: theme.textMuted }]}>Win Rate</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 16,
    gap: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  userInfoCol: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  planTag: {
    backgroundColor: '#09090B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  planTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  streakSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 2,
  },
  statValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabelText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#66666E',
  },
});
