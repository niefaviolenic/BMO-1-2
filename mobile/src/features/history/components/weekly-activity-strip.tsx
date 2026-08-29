import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Typography } from '@/constants/theme';
export type ActivityDayStatus = 'clean' | 'relapse' | 'pending';

export type ActivityDayItem = {
  dayLabel: string;
  dateNumber: number;
  status: ActivityDayStatus;
  isToday?: boolean;
};

export type WeeklyActivityStripProps = {
  title?: string;
  dateRangeText?: string;
  days?: ActivityDayItem[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_DAYS: ActivityDayItem[] = [
  { dayLabel: 'MON', dateNumber: 5, status: 'clean' },
  { dayLabel: 'TUE', dateNumber: 6, status: 'clean' },
  { dayLabel: 'WED', dateNumber: 7, status: 'clean' },
  { dayLabel: 'THU', dateNumber: 8, status: 'relapse' },
  { dayLabel: 'FRI', dateNumber: 9, status: 'clean' },
  { dayLabel: 'SAT', dateNumber: 10, status: 'clean', isToday: true },
  { dayLabel: 'SUN', dateNumber: 11, status: 'pending' },
];

export function WeeklyActivityStrip({
  title = "This Week's Activity",
  dateRangeText = '05 - 11 Aug',
  days = DEFAULT_DAYS,
  style,
  testID = 'weekly-activity-strip',
}: WeeklyActivityStripProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Header Row */}
      <View style={styles.headerRow} testID={`${testID}-header`}>
        <Text style={[styles.headerTitle, { color: theme.text }]} testID={`${testID}-title`}>
          {title}
        </Text>
        <View
          style={[styles.dateBadge, { backgroundColor: theme.backgroundElement }]}
          testID={`${testID}-date-badge`}
        >
          <Text style={[styles.dateBadgeText, { color: theme.textSecondary }]}>{dateRangeText}</Text>
        </View>
      </View>

      {/* Days Row */}
      <View style={styles.daysRow} testID={`${testID}-days-row`}>
        {days.map((item, index) => {
          const isToday = !!item.isToday;
          let dotColor = '#CBD5E1';
          let shadowStyle: any = null;

          if (item.status === 'clean') {
            dotColor = '#10B981';
            shadowStyle = styles.cleanDotShadow;
          } else if (item.status === 'relapse') {
            dotColor = '#EF4444';
            shadowStyle = styles.relapseDotShadow;
          } else {
            dotColor = '#CBD5E1';
            shadowStyle = styles.pendingDotShadow;
          }

          return (
            <View
              key={`${item.dayLabel}-${item.dateNumber}-${index}`}
              style={[
                styles.dayCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
                isToday && [
                  styles.todayCard,
                  {
                    backgroundColor: theme.buttonPrimaryBackground,
                    borderColor: theme.buttonPrimaryBackground,
                  },
                ],
              ]}
              testID={`${testID}-day-${index}`}
            >
              <Text
                style={[
                  styles.dayLabelText,
                  { color: theme.textSecondary },
                  isToday && [styles.todayLabelText, { color: theme.buttonPrimaryText }],
                ]}
              >
                {item.dayLabel}
              </Text>
              <Text
                style={[
                  styles.dateNumberText,
                  { color: theme.text },
                  isToday && [styles.todayNumberText, { color: theme.buttonPrimaryText }],
                ]}
              >
                {item.dateNumber}
              </Text>
              <View style={styles.dotContainer}>
                <View style={[styles.statusDot, { backgroundColor: dotColor }, shadowStyle]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECF0F5',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  dayCard: {
    flex: 1,
    height: 54,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  todayCard: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    borderWidth: 1.5,
  },
  dayLabelText: {
    fontSize: Typography.caption2.fontSize,
    fontWeight: '600',
    color: '#64748B',
  },
  todayLabelText: {
    color: '#E2E8F0',
  },
  dateNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayNumberText: {
    color: '#FFFFFF',
  },
  dotContainer: {
    width: 6,
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cleanDotShadow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 2,
  },
  relapseDotShadow: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 2,
  },
  pendingDotShadow: {
    shadowColor: '#CBD5E1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
});
