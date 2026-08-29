import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleHydrationCardProps = Partial<ScheduleCardProps>;

export const DEFAULT_HYDRATION_PROMPT =
  'Remind me to drink water and take a quick stretch break every afternoon at 2 PM';

export function ScheduleHydrationCard({
  title = 'Hydration & Stretch',
  description = DEFAULT_HYDRATION_PROMPT,
  iconEmoji = '💧',
  variant = 'suggestion',
  onPress,
  onActionPress,
  onLongPress,
  style,
  testID = 'schedule-hydration-card',
}: ScheduleHydrationCardProps) {
  return (
    <ScheduleCard
      statusTag="REMINDER"
      title={title}
      description={description}
      iconEmoji={iconEmoji}
      variant={variant}
      onPress={onPress}
      onActionPress={onActionPress}
      onLongPress={onLongPress}
      style={style}
      testID={testID}
    />
  );
}
