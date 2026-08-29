import figma from '@figma/code-connect';
import { PluginAppSection } from './plugin-app-section';

figma.connect(
  PluginAppSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134155',
  {
    props: {
      appName: figma.string('WhatsApp'),
    },
    example: (props) => <PluginAppSection appName={props.appName} />,
  }
);
