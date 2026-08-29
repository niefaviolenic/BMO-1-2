import figma from '@figma/code-connect';
import { HeaderSaveButton } from './header-save-button';

figma.connect(
  HeaderSaveButton,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136698',
  {
    props: {
      label: figma.string('Save'),
    },
    example: ({ label }) => <HeaderSaveButton label={label} onPress={() => {}} />,
  }
);
