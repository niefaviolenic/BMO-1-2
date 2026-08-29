import figma from '@figma/code-connect';
import { UserMessageBubble } from './user-message-bubble';

figma.connect(
  UserMessageBubble,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133120',
  {
    props: {
      message: figma.string('Hello World'),
    },
    example: (props) => <UserMessageBubble message={props.message} />,
  }
);
