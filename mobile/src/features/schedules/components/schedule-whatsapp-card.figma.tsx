import figma from '@figma/code-connect';
import { ScheduleWhatsAppCard } from './schedule-whatsapp-card';

figma.connect(
  ScheduleWhatsAppCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135847',
  {
    props: {},
    example: () => <ScheduleWhatsAppCard />,
  }
);
