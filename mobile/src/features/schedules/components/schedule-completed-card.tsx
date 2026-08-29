import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleCompletedCardProps = Partial<ScheduleCardProps>;

export function ScheduleCompletedCard({
  title = 'Message at 15:08',
  description = 'Send me a message.',
  onPress,
  onLongPress,
  style,
  testID = 'schedule-completed-card',
}: ScheduleCompletedCardProps) {
  return (
    <ScheduleCard
      statusTag="COMPLETED"
      title={title}
      description={description}
      onPress={onPress}
      onLongPress={onLongPress}
      style={style}
      testID={testID}
    />
  );
}
