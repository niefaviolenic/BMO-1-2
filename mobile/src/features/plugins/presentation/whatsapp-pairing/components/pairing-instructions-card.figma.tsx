import figma from '@figma/code-connect';

import { PairingInstructionsCard } from './pairing-instructions-card';

figma.connect(
  PairingInstructionsCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134732',
  {
    example: () => <PairingInstructionsCard />,
  }
);
