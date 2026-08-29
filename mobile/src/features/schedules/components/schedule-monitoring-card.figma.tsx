import figma from '@figma/code-connect';
import { ScheduleMonitoringCard } from './schedule-monitoring-card';

figma.connect(
  ScheduleMonitoringCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135927',
  {
    props: {},
    example: () => <ScheduleMonitoringCard />,
  }
);
