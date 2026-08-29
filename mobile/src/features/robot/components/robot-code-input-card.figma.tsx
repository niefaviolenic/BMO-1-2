import figma from '@figma/code-connect';

import { RobotCodeInputCard } from './robot-code-input-card';

figma.connect(
  RobotCodeInputCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138316',
  {
    props: {
      code: figma.string('XMD892'),
      isError: figma.boolean('Error'),
    },
    example: ({ code, isError }) => (
      <RobotCodeInputCard code={code} isError={isError} />
    ),
  }
);
