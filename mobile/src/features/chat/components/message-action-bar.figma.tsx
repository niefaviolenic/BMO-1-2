import figma from '@figma/code-connect';
import { MessageActionBar } from './message-action-bar';

figma.connect(
  MessageActionBar,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133449',
  {
    props: {},
    example: () => (
      <MessageActionBar
        onCopy={() => {}}
        onSpeak={() => {}}
        onThumbsDown={() => {}}
        onShare={() => {}}
      />
    ),
  }
);
