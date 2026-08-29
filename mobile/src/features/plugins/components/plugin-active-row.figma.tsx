import figma from '@figma/code-connect';
import { PluginActiveRow } from './plugin-active-row';

figma.connect(
  PluginActiveRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=697-1990',
  {
    props: {
      title: figma.string('WhatsApp'),
      description: figma.string('Messaging & physical device alerts'),
    },
    example: (props) => (
      <PluginActiveRow
        title={props.title}
        description={props.description}
      />
    ),
  }
);
