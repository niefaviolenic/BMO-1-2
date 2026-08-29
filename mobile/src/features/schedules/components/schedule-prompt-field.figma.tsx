import figma from '@figma/code-connect';
import { SchedulePromptField } from './schedule-prompt-field';

figma.connect(
  SchedulePromptField,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136158',
  {
    props: {},
    example: () => <SchedulePromptField />,
  }
);
