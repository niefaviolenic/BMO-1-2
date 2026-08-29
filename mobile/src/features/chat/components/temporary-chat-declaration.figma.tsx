import figma from '@figma/code-connect';
import { TemporaryChatDeclaration } from './temporary-chat-declaration';

figma.connect(
  TemporaryChatDeclaration,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133218',
  {
    props: {
      title: figma.string('Temporary Chat'),
      subtitle: figma.string(
        "This chat won't appear in history, use or update Joy memory, or be used to train our models. For safety purposes, we may keep a copy for up to 30 days."
      ),
    },
    example: (props) => (
      <TemporaryChatDeclaration title={props.title} subtitle={props.subtitle} />
    ),
  }
);
