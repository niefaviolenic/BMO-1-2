import figma from '@figma/code-connect';

import { PairingCodeDisplayBox } from './pairing-code-display-box';

figma.connect(
  PairingCodeDisplayBox,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134768',
  {
    example: () => (
      <PairingCodeDisplayBox
        code="8K2P9XLM"
        expiresInSeconds={599}
      />
    ),
  }
);
