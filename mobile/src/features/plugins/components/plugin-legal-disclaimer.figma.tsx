import figma from '@figma/code-connect';

import { PluginLegalDisclaimer } from './plugin-legal-disclaimer';

figma.connect(
  PluginLegalDisclaimer,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134242',
  {
    props: {
      appName: figma.string('WhatsApp'),
    },
    example: (props) => (
      <PluginLegalDisclaimer appName={props.appName} />
    ),
  }
);
