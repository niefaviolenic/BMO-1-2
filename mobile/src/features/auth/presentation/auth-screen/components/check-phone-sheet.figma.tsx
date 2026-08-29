import figma from '@figma/code-connect';

import { CheckPhoneContent } from './check-phone-sheet';

figma.connect(
  CheckPhoneContent,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-132931',
  {
    props: {
      phoneNumber: figma.string('+62 812-3456-7890'),
    },
    example: (props) => (
      <CheckPhoneContent phoneNumber={props.phoneNumber} />
    ),
  }
);
