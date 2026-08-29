import figma from '@figma/code-connect';
import { ScheduleDaysSelectionField } from './schedule-days-selection-field';

figma.connect(
  ScheduleDaysSelectionField,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136340',
  {
    props: {},
    example: () => <ScheduleDaysSelectionField />,
  }
);
