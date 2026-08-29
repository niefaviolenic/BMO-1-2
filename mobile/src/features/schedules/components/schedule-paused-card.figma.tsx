import figma from '@figma/code-connect';
import { SchedulePausedCard } from './schedule-paused-card';

figma.connect(
  SchedulePausedCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135958',
  {
    props: {},
    example: () => <SchedulePausedCard />,
  }
);
