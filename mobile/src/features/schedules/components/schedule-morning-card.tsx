import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleMorningCardProps = Partial<ScheduleCardProps>;

export const DEFAULT_MORNING_PROMPT =
  'Give me an inspiring quote and reminder for my morning routine at 7 AM';

export function ScheduleMorningCard({
  title = 'Morning Kickoff',
  description = DEFAULT_MORNING_PROMPT,
  iconEmoji = '☀️',
  variant = 'suggestion',
  onPress,
  onActionPress,
  onLongPress,
  style,
  testID = 'schedule-morning-card',
}: ScheduleMorningCardProps) {
  return (
    <ScheduleCard
      statusTag="DAILY"
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
