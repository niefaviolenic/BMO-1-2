import figma from '@figma/code-connect';
import { InstalledPluginsRow } from './installed-plugins-row';

figma.connect(
  InstalledPluginsRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133496',
  {
    props: {},
    example: () => <InstalledPluginsRow />,
  }
);
