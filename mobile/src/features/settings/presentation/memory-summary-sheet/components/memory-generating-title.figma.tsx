import figma from '@figma/code-connect';
import { MemoryGeneratingTitle } from './memory-generating-title';

figma.connect(
  MemoryGeneratingTitle,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136819',
  {
    props: {
      title: figma.string('Memory summary'),
      subtitle: figma.string('Generating'),
    },
    example: (props) => (
      <MemoryGeneratingTitle
        title={props.title}
        subtitle={props.subtitle}
      />
    ),
  }
);
