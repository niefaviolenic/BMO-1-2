import figma from '@figma/code-connect';

import { SettingsLogoutCard } from './settings-logout-card';

figma.connect(
  SettingsLogoutCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136529',
  {
    example: () => <SettingsLogoutCard />,
  }
);
