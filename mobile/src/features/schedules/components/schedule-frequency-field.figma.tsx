import figma from '@figma/code-connect';
import { ScheduleFrequencyField } from './schedule-frequency-field';

figma.connect(
  ScheduleFrequencyField,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136330',
  {
    props: {},
    example: () => <ScheduleFrequencyField />,
  }
);
