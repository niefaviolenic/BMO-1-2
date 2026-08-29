import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleWeatherCardProps = Partial<ScheduleCardProps>;

export function ScheduleWeatherCard({
  title = 'Weather Update',
  description = "Tell me today's weather every morning at 7 AM",
  iconEmoji = '🌤️',
  variant = 'suggestion',
  onPress,
  onActionPress,
  onLongPress,
  style,
  testID = 'schedule-weather-card',
}: ScheduleWeatherCardProps) {
  return (
    <ScheduleCard
      statusTag="WEATHER"
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
