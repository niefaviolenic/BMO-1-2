import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleMonitoringCardProps = Partial<ScheduleCardProps>;

export function ScheduleMonitoringCard({
  title = 'Jakarta Electronic Shows',
  description = 'Check for newly announced electronic and hip-hop concerts in Jakarta. Notify me when artists in these genres announce a show, including th...',
  footerText = 'Runs in 45 seconds',
  onPress,
  onLongPress,
  style,
  testID = 'schedule-monitoring-card',
}: ScheduleMonitoringCardProps) {
  return (
    <ScheduleCard
      statusTag="MONITORING"
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
