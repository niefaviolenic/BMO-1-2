import figma from '@figma/code-connect';
import { SearchInput } from './search-input';

figma.connect(
  SearchInput,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133488',
  {
    props: {
      placeholder: figma.string('Search'),
      value: figma.string('value'),
    },
    example: (props) => (
      <SearchInput
        placeholder={props.placeholder}
        value={props.value}
      />
    ),
  }
);
