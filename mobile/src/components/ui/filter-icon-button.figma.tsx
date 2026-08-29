import figma from '@figma/code-connect';
import { FilterIconButton } from './filter-icon-button';

figma.connect(
  FilterIconButton,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136001',
  {
    props: {},
    example: () => <FilterIconButton onPress={() => {}} />,
  }
);
