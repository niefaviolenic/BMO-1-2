import figma from '@figma/code-connect';
import { PluginUninstallModal } from './plugin-uninstall-modal';

figma.connect(
  PluginUninstallModal,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135608',
  {
    props: {
      pluginName: figma.string('pluginName'),
    },
    example: (props) => (
      <PluginUninstallModal
        visible
        pluginName={props.pluginName ?? 'WhatsApp'}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    ),
  }
);
