import figma from '@figma/code-connect';
import { ScheduleWeeklyCard } from './schedule-weekly-card';

figma.connect(
  ScheduleWeeklyCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135933',
  {
    props: {},
    example: () => <ScheduleWeeklyCard />,
  }
);
