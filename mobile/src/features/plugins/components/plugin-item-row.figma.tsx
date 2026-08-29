import figma from '@figma/code-connect';
import { PluginItemRow } from './plugin-item-row';

figma.connect(
  PluginItemRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133558',
  {
    props: {
      title: figma.string('Adobe (formerly Photoshop)'),
      description: figma.string('Design, combine, and edit'),
    },
    example: (props) => (
      <PluginItemRow
        title={props.title}
        description={props.description}
        iconBgColor="#D91F26"
        actionType="add"
      />
    ),
  }
);
