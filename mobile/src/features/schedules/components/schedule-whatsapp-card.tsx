import { ScheduleCard, type ScheduleCardProps } from './schedule-card';

export type ScheduleWhatsAppCardProps = Partial<ScheduleCardProps>;

export function ScheduleWhatsAppCard({
  title = 'WhatsApp John',
  description = 'Send a WhatsApp message to John at 5 PM',
  iconEmoji = '💬',
  variant = 'suggestion',
  onPress,
  onActionPress,
  onLongPress,
  style,
  testID = 'schedule-whatsapp-card',
}: ScheduleWhatsAppCardProps) {
  return (
    <ScheduleCard
      statusTag="WHATSAPP"
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
