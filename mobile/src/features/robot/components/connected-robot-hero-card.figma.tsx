import figma from '@figma/code-connect';

import { ConnectedRobotHeroCard } from './connected-robot-hero-card';

figma.connect(
  ConnectedRobotHeroCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138388',
  {
    props: {
      title: figma.string('Joy Robot Connected!'),
      status: figma.string('Online'),
      batteryLevel: figma.string('85%'),
      wifiStatus: figma.string('WiFi Active'),
      description: figma.string(
        'Your Joy physical robot is synchronized & ready to interact, speak, and deliver smart notifications.'
      ),
    },
    example: ({ title, status, batteryLevel, wifiStatus, description }) => (
      <ConnectedRobotHeroCard
        title={title}
        status={status}
        batteryLevel={batteryLevel}
        wifiStatus={wifiStatus}
        description={description}
      />
    ),
  }
);
