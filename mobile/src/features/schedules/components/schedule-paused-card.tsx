import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type SchedulePausedCardProps = Partial<ScheduleCardProps>;

export function SchedulePausedCard({
  title = 'Jakarta Electronic Shows',
  description = 'Check for newly announced electronic and hip-hop concerts in Jakarta. Notify me when artists in these genres announce a show, including th...',
  actionText = 'Resume',
  onPress,
  onLongPress,
  onActionPress,
  style,
  testID = 'schedule-paused-card',
}: SchedulePausedCardProps) {
  return (
    <ScheduleCard
      statusTag="PAUSED"
      title={title}
      description={description}
      actionText={actionText}
      onPress={onPress}
      onLongPress={onLongPress}
      onActionPress={onActionPress}
      style={style}
      testID={testID}
    />
  );
}
