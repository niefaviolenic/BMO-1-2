import figma from '@figma/code-connect';

import { PairingCodeHero } from './pairing-code-hero';

figma.connect(
  PairingCodeHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134765',
  {
    props: {
      title: figma.string('title'),
      subtitle: figma.string('subtitle'),
    },
    example: (props) => (
      <PairingCodeHero title={props.title} subtitle={props.subtitle} />
    ),
  }
);
