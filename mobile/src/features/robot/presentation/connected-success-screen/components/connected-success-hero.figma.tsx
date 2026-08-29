import figma from '@figma/code-connect';

import { ConnectedSuccessHero } from './connected-success-hero';

figma.connect(
  ConnectedSuccessHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138359',
  {
    props: {
      title: figma.string('Title'),
      subtitle: figma.string('Subtitle'),
      deviceName: figma.string('Device Name'),
      deviceStatus: figma.string('Device Status'),
    },
    example: ({ title, subtitle, deviceName, deviceStatus }) => (
      <ConnectedSuccessHero
        title={title}
        subtitle={subtitle}
        deviceName={deviceName}
        deviceStatus={deviceStatus}
      />
    ),
  }
);
