import figma from '@figma/code-connect';
import { UnreadBadge } from './unread-badge';

figma.connect(
  UnreadBadge,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133231',
  {
    props: {
      count: figma.string('1'),
    },
    example: (props) => <UnreadBadge count={props.count} />,
  }
);
