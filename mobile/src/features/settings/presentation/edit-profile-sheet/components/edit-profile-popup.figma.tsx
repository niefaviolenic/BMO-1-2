import figma from '@figma/code-connect';
import { EditProfilePopup } from './edit-profile-popup';

figma.connect(
  EditProfilePopup,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136662',
  {
    props: {
      name: figma.string('Name'),
      username: figma.string('Username'),
    },
    example: (props) => (
      <EditProfilePopup
        name={props.name}
        username={props.username}
      />
    ),
  }
);
