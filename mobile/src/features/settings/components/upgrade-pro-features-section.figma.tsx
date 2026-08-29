import figma from '@figma/code-connect';

import { UpgradeProFeaturesSection } from './upgrade-pro-features-section';

figma.connect(
  UpgradeProFeaturesSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138123',
  {
    props: {
      title: figma.string('Everything in Free, and:'),
    },
    example: (props) => (
      <UpgradeProFeaturesSection title={props.title} />
    ),
  }
);
