import figma from '@figma/code-connect';
import { ScheduleRepeatField } from './schedule-repeat-field';

figma.connect(
  ScheduleRepeatField,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136160',
  {
    props: {},
    example: () => <ScheduleRepeatField />,
  }
);
