import figma from '@figma/code-connect';

import { OccupationCardContainer } from './occupation-card-container';

figma.connect(
  OccupationCardContainer,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136797',
  {
    props: {
      placeholder: figma.string('Engineer, student, etc.'),
    },
    example: (props) => (
      <OccupationCardContainer
        placeholder={props.placeholder}
      />
    ),
  }
);
