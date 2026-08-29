import figma from '@figma/code-connect';
import { AllowedContactRow } from './allowed-contact-row';

figma.connect(
  AllowedContactRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135781',
  {
    props: {
      name: figma.string('Name'),
      phoneNumber: figma.string('Phone Number'),
    },
    example: (props) => (
      <AllowedContactRow
        name={props.name}
        phoneNumber={props.phoneNumber}
      />
    ),
  }
);
