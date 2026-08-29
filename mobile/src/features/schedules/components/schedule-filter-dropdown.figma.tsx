import figma from '@figma/code-connect';
import { ScheduleFilterDropdown } from './schedule-filter-dropdown';

figma.connect(
  ScheduleFilterDropdown,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135900',
  {
    props: {},
    example: () => <ScheduleFilterDropdown />,
  }
);
