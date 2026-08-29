import figma from '@figma/code-connect';

import { RobotDeviceStatusCard } from './robot-device-status-card';

figma.connect(
  RobotDeviceStatusCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138365',
  {
    props: {
      name: figma.string('Joy Robot'),
      status: figma.string('Paired & Ready'),
    },
    example: ({ name, status }) => (
      <RobotDeviceStatusCard name={name} status={status} />
    ),
  }
);
