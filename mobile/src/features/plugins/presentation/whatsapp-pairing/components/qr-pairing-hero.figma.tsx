import figma from '@figma/code-connect';

import { QRPairingHero } from './qr-pairing-hero';

figma.connect(
  QRPairingHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134859',
  {
    props: {
      title: figma.string('Title'),
      subtitle: figma.string('Subtitle'),
    },
    example: ({ title, subtitle }) => (
      <QRPairingHero title={title} subtitle={subtitle} />
    ),
  }
);
