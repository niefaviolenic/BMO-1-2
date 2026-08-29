import figma from '@figma/code-connect';
import { ProfileHeaderBlock } from './profile-header-block';

figma.connect(
  ProfileHeaderBlock,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136425',
  {
    props: {
      name: figma.string('Rangga Hadi Putra'),
    },
    example: (props) => (
      <ProfileHeaderBlock
        name={props.name}
      />
    ),
  }
);
