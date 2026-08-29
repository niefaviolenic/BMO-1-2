import figma from '@figma/code-connect';
import { PluginReadActionsSection } from './plugin-read-actions-section';

figma.connect(
  PluginReadActionsSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135128',
  {
    props: {},
    example: () => <PluginReadActionsSection />,
  }
);
