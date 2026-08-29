import figma from '@figma/code-connect';
import { PluginPolicyContainer } from './plugin-policy-container';

figma.connect(
  PluginPolicyContainer,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134112',
  {
    example: () => <PluginPolicyContainer />,
  }
);
