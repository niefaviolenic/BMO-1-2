import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleWeeklyCardProps = Partial<ScheduleCardProps>;

export function ScheduleWeeklyCard({
  title = 'Weekend Nature Ideas',
  description = 'Recommend a few exciting things to do nearby this weekend, tailored to my interests in nature and hiking, a budget of Rp250k-750k, and the...',
  footerText = 'Thursdays · Morning',
  onPress,
  onLongPress,
  style,
  testID = 'schedule-weekly-card',
}: ScheduleWeeklyCardProps) {
  return (
    <ScheduleCard
      statusTag="WEEKLY"
      title={title}
      description={description}
      footerText={footerText}
      onPress={onPress}
      onLongPress={onLongPress}
      style={style}
      testID={testID}
    />
  );
}
