import figma from '@figma/code-connect';

import { CameraScanHero } from './camera-scan-hero';

figma.connect(
  CameraScanHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138269',
  {
    props: {
      title: figma.string('Title'),
      subtitle: figma.string('Subtitle'),
    },
    example: ({ title, subtitle }) => (
      <CameraScanHero title={title} subtitle={subtitle} />
    ),
  }
);
