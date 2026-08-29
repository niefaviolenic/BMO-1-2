import figma from '@figma/code-connect';
import { WeeklyActivityStrip } from './weekly-activity-strip';

figma.connect(
  WeeklyActivityStrip,
  'https://www.figma.com/design/Ofxfhj3hWqVKSZu9WN7Syy/PMO?node-id=90-3191',
  {
    props: {},
    example: () => <WeeklyActivityStrip />,
  }
);
