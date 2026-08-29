import figma from '@figma/code-connect';
import { PromptSuggestionItem } from './prompt-suggestion-item';

figma.connect(
  PromptSuggestionItem,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133062',
  {
    props: {
      label: figma.string('Brainstorm ideas'),
    },
    example: (props) => <PromptSuggestionItem label={props.label} />,
  }
);
