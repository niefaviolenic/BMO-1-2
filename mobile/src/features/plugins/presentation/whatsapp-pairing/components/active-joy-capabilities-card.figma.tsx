import figma from '@figma/code-connect';

import { ActiveJoyCapabilitiesCard } from './active-joy-capabilities-card';

figma.connect(
  ActiveJoyCapabilitiesCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134826',
  {
    example: () => <ActiveJoyCapabilitiesCard />,
  }
);
