import figma from '@figma/code-connect';

import { UpgradeProCtaFooter } from './upgrade-pro-cta-footer';

figma.connect(
  UpgradeProCtaFooter,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138150',
  {
    props: {
      buttonText: figma.string('Upgrade'),
      autoRenewText: figma.string('Auto-renews monthly. Cancel anytime.'),
      disclaimerText: figma.string('Unlimited subject to abuse guardrails.'),
    },
    example: (props) => (
      <UpgradeProCtaFooter
        buttonText={props.buttonText}
        autoRenewText={props.autoRenewText}
        disclaimerText={props.disclaimerText}
      />
    ),
  }
);
