import figma from '@figma/code-connect';
import { PluginConnectedAccountCard } from './plugin-connected-account-card';

figma.connect(
  PluginConnectedAccountCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135069',
  {
    props: {
      title: figma.string('WhatsApp'),
      subtitle: figma.string('Connected to +62 812-3456-7890'),
    },
    example: (props) => (
      <PluginConnectedAccountCard
        title={props.title}
        subtitle={props.subtitle}
      />
    ),
  }
);
