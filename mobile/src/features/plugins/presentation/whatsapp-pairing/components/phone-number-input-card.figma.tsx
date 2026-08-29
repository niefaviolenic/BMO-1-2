import figma from '@figma/code-connect';

import { PhoneNumberInputCard } from './phone-number-input-card';

figma.connect(
  PhoneNumberInputCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134725',
  {
    props: {
      countryCode: figma.string('+62'),
      phoneNumber: figma.string('812 3456 7890'),
    },
    example: (props) => (
      <PhoneNumberInputCard
        countryCode={props.countryCode}
        phoneNumber={props.phoneNumber}
      />
    ),
  }
);
