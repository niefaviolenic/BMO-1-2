import figma from '@figma/code-connect';
import { ScheduleTimeField } from './schedule-time-field';

figma.connect(
  ScheduleTimeField,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136170',
  {
    props: {},
    example: () => <ScheduleTimeField />,
  }
);
