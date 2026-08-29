import figma from '@figma/code-connect';
import { PluginConnectSheet } from './plugin-connect-sheet';

figma.connect(
  PluginConnectSheet,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133789',
  {
    example: () => (
      <PluginConnectSheet
        isVisible={true}
        onClose={() => {}}
        onConnect={() => {}}
        pluginTitle="WhatsApp"
      />
    ),
  }
);
