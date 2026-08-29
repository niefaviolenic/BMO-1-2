import figma from '@figma/code-connect';

import { RobotHeroCard } from './robot-hero-card';

figma.connect(
  RobotHeroCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138226',
  {
    props: {
      title: figma.string('Connect Your Joy Robot'),
      description: figma.string(
        'Bring your AI assistant into physical reality with expressiveness, voice interaction, & smart notifications.'
      ),
    },
    example: ({ title, description }) => (
      <RobotHeroCard title={title} description={description} />
    ),
  }
);
