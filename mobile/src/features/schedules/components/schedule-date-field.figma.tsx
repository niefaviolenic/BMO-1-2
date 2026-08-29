import figma from '@figma/code-connect';
import { ScheduleDateField } from './schedule-date-field';

figma.connect(
  ScheduleDateField,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136404',
  {
    props: {},
    example: () => <ScheduleDateField />,
  }
);
