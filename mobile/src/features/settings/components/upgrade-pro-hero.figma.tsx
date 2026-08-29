import figma from '@figma/code-connect';

import { UpgradeProHero } from './upgrade-pro-hero';

figma.connect(
  UpgradeProHero,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138106',
  {
    props: {
      title: figma.string('Get Joy Plus'),
      subtitle: figma.string('Get more of Joy with expanded access'),
    },
    example: (props) => (
      <UpgradeProHero
        title={props.title}
        subtitle={props.subtitle}
      />
    ),
  }
);
