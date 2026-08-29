import figma from '@figma/code-connect';
import { ScheduleCompletedCard } from './schedule-completed-card';

figma.connect(
  ScheduleCompletedCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136006',
  {
    props: {},
    example: () => <ScheduleCompletedCard />,
  }
);
