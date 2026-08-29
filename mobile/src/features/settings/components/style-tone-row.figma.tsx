import figma from '@figma/code-connect';
import { StyleToneRow } from './style-tone-row';

figma.connect(
  StyleToneRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136702',
  {
    props: {
      label: figma.string('Base style and tone'),
      value: figma.string('Cynical'),
    },
    example: (props) => (
      <StyleToneRow
        label={props.label}
        value={props.value}
      />
    ),
  }
);
