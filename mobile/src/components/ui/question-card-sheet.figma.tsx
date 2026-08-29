import figma from '@figma/code-connect';
import { QuestionCardSheet } from './question-card-sheet';

figma.connect(
  QuestionCardSheet,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133258',
  {
    props: {
      question: figma.string('What area should I search around each week?'),
    },
    example: (props) => (
      <QuestionCardSheet
        isVisible={true}
        onClose={() => {}}
        question={props.question}
        options={[
          { id: '1', label: 'My current location' },
          { id: '2', label: 'Home' },
          { id: '3', label: 'Work' },
          { id: '4', label: 'Another location' },
        ]}
      />
    ),
  }
);
