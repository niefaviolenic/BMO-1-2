import figma from '@figma/code-connect';
import { Toggle } from './toggle';

figma.connect(
  Toggle,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135758',
  {
    props: {
      value: figma.enum('State', {
        ON: true,
        OFF: false,
      }),
    },
    example: (props) => (
      <Toggle value={props.value ?? true} onValueChange={() => {}} />
    ),
  }
);
