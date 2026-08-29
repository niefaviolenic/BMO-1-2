import figma from '@figma/code-connect';

import { BugReportTextareaCard } from './bug-report-textarea-card';

figma.connect(
  BugReportTextareaCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138007',
  {
    props: {
      label: figma.string('What happened?'),
      placeholder: figma.string('Tell us about the issue you encountered'),
      value: figma.string(''),
    },
    example: (props) => (
      <BugReportTextareaCard
        label={props.label}
        placeholder={props.placeholder}
        value={props.value}
      />
    ),
  }
);
