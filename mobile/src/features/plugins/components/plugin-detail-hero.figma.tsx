import figma from '@figma/code-connect';
import { PluginDetailHero } from './plugin-detail-hero';

figma.connect(
  PluginDetailHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134136',
  {
    props: {
      title: figma.string('WhatsApp'),
      subtitle: figma.string('Messaging, voice notes, and media'),
    },
    example: (props) => (
      <PluginDetailHero title={props.title} subtitle={props.subtitle} />
    ),
  }
);
