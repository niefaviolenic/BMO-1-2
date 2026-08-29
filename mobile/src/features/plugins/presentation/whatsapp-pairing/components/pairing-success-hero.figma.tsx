import figma from '@figma/code-connect';

import { PairingSuccessHero } from './pairing-success-hero';

figma.connect(
  PairingSuccessHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134817',
  {
    props: {
      phoneNumber: figma.string('phoneNumber'),
      statusText: figma.string('statusText'),
    },
    example: ({ phoneNumber, statusText }) => (
      <PairingSuccessHero
        phoneNumber={phoneNumber}
        statusText={statusText}
      />
    ),
  }
);
