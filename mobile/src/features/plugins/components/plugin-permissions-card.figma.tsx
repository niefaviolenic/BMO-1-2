import figma from '@figma/code-connect';
import { PluginPermissionsCard } from './plugin-permissions-card';

figma.connect(
  PluginPermissionsCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135077',
  {
    props: {
      label: figma.string('label'),
      value: figma.string('value'),
    },
    example: (props) => (
      <PluginPermissionsCard
        label={props.label}
        value={props.value}
      />
    ),
  }
);
