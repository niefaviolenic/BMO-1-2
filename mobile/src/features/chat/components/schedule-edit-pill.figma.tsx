import figma from '@figma/code-connect';
import { ScheduleEditPill } from './schedule-edit-pill';

figma.connect(
  ScheduleEditPill,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133445',
  {
    props: {
      scheduleText: figma.string('Thursdays'),
      titleText: figma.string('Weekend Nature Ideas'),
    },
    example: (props) => (
      <ScheduleEditPill scheduleText={props.scheduleText} titleText={props.titleText} />
    ),
  }
);
