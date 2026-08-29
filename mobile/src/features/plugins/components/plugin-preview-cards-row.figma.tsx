import figma from '@figma/code-connect';

import { PluginPreviewCardsRow } from './plugin-preview-cards-row';

figma.connect(
  PluginPreviewCardsRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134144',
  {
    props: {},
    example: () => <PluginPreviewCardsRow />,
  }
);
