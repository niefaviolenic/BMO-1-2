import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ScheduleTokens } from '@/constants/theme';

export type ScheduleCardStatus =
  | 'MONITORING'
  | 'WEEKLY'
  | 'PAUSED'
  | 'COMPLETED'
  | 'WHATSAPP'
  | 'WEATHER'
  | 'REMINDER'
  | 'DAILY'
  | 'HEALTH';

export type ScheduleCardVariant = 'default' | 'suggestion';

export type ScheduleCardProps = {
  statusTag?: ScheduleCardStatus | string;
  title: string;
  description: string;
  footerText?: string;
  iconEmoji?: string;
  variant?: ScheduleCardVariant;
  onPress?: () => void;
  onLongPress?: () => void;
  onActionPress?: () => void;
  actionText?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleCard({
  statusTag,
  title,
  description,
  footerText,
  iconEmoji,
  variant = 'default',
  onPress,
  onLongPress,
  onActionPress,
  actionText,
  style,
  testID = 'schedule-card',
}: ScheduleCardProps) {
  const theme = useTheme();

  const isPromptCard =
    variant === 'suggestion' ||
    statusTag === 'WHATSAPP' ||
    statusTag === 'WEATHER' ||
    statusTag === 'REMINDER' ||
    statusTag === 'DAILY' ||
    statusTag === 'HEALTH' ||
    Boolean(iconEmoji);
  const useDashedBorder = variant === 'suggestion';
  const isPaused = statusTag === 'PAUSED';
  const isCompleted = statusTag === 'COMPLETED';
  const isBlueTag = statusTag === 'MONITORING' || statusTag === 'WEEKLY';

  const tagColor = isBlueTag
    ? theme.linkPrimary
    : isPaused || isCompleted
      ? theme.textMuted
      : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        useDashedBorder && styles.suggestionCard,
        style,
        pressed && (onPress || onLongPress) && styles.pressed,
      ]}
    >
      {isPromptCard ? (
        <View style={styles.whatsAppContainer}>
          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <Text style={styles.emoji}>{iconEmoji ?? '💬'}</Text>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
            </View>
            {onActionPress || onPress ? (
              <Pressable
                onPress={onActionPress ?? onPress}
                hitSlop={8}
                testID={`${testID}-action`}
                style={({ pressed: actionPressed }) => [actionPressed && styles.pressed]}
              >
                <Text style={[styles.plusIcon, { color: theme.textMuted }]}>+</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.descriptionText, { color: theme.textSecondary }]} numberOfLines={2}>
            {description}
          </Text>
        </View>
      ) : (
        <View style={styles.standardContainer}>
          {statusTag ? (
            <Text style={[styles.statusTag, { color: tagColor }]}>{statusTag}</Text>
          ) : null}
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.descriptionText, { color: theme.textSecondary }]} numberOfLines={2}>
            {description}
          </Text>

          {footerText || actionText || isPaused ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <View style={styles.footerRow}>
                {isPaused && actionText ? (
                  <Pressable
                    onPress={onActionPress}
                    testID={`${testID}-resume`}
                    style={({ pressed: resumePressed }) => [styles.resumeRow, resumePressed && styles.pressed]}
                  >
                    <Text style={[styles.footerText, { color: theme.textMuted }]}>{actionText}</Text>
                    <Text style={[styles.rotateIcon, { color: theme.textMuted }]}>↻</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.footerText, { color: theme.textMuted }]}>{footerText ?? actionText}</Text>
                )}
              </View>
            </>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: ScheduleTokens.borderRadius.card,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  suggestionCard: {
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
    borderRadius: ScheduleTokens.borderRadius.suggestionCard,
  },
  pressed: {
    opacity: 0.8,
  },
  whatsAppContainer: {
    gap: 8,
  },
  standardContainer: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 14,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  descriptionText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  plusIcon: {
    fontSize: 18,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
  },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  rotateIcon: {
    fontSize: 14,
  },
});
