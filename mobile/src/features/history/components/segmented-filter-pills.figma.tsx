import figma from '@figma/code-connect';
import { SegmentedFilterPills } from './segmented-filter-pills';

figma.connect(
  SegmentedFilterPills,
  'https://www.figma.com/design/Ofxfhj3hWqVKSZu9WN7Syy/PMO?node-id=90-3222',
  {
    props: {},
    example: () => <SegmentedFilterPills />,
  }
);
