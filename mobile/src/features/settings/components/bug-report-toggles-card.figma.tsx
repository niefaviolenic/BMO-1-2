import figma from '@figma/code-connect';

import { BugReportTogglesCard } from './bug-report-toggles-card';

figma.connect(
  BugReportTogglesCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138043',
  {
    props: {
      includeScreenshot: figma.boolean('Include screenshot in report'),
      label: figma.string('Include screenshot in report'),
    },
    example: (props) => (
      <BugReportTogglesCard
        includeScreenshot={props.includeScreenshot}
        label={props.label}
      />
    ),
  }
);
