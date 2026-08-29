import figma from '@figma/code-connect';
import { RobotOptionCard } from './robot-option-card';

figma.connect(
  RobotOptionCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138236',
  {
    example: () => (
      <RobotOptionCard
        title="I Already Have a Joy Robot"
        description="Pair with 6-digit code"
      />
    ),
  }
);
