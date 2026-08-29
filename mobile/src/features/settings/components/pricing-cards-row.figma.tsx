import figma from '@figma/code-connect';

import { PricingCardsRow } from './pricing-cards-row';

figma.connect(
  PricingCardsRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138114',
  {
    props: {
      selectedPlanId: figma.enum('Selected Plan', {
        'Joy Plus': 'plus',
        'Joy Pro': 'pro',
      }),
    },
    example: (props) => (
      <PricingCardsRow selectedPlanId={props.selectedPlanId} />
    ),
  }
);
