import figma from '@figma/code-connect';
import { ScheduleContextMenu } from './schedule-context-menu';

figma.connect(
  ScheduleContextMenu,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136040',
  {
    props: {},
    example: () => <ScheduleContextMenu />,
  }
);
