import figma from '@figma/code-connect';
import { AddAllowedContactRow } from './add-allowed-contact-row';

figma.connect(
  AddAllowedContactRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135824',
  {
    props: {
      label: figma.string('Add Allowed Contact'),
    },
    example: (props) => (
      <AddAllowedContactRow label={props.label} />
    ),
  }
);
