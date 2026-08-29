import figma from '@figma/code-connect';

import { SettingsHelpSection } from './settings-help-section';

figma.connect(
  SettingsHelpSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136511',
  {
    example: () => <SettingsHelpSection />,
  }
);
