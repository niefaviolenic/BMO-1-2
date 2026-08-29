import figma from '@figma/code-connect';

import { SettingsSheet } from './settings-sheet';

figma.connect(
  SettingsSheet,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136412',
  {
    props: {
      name: figma.string('Name'),
    },
    example: (props) => (
      <SettingsSheet
        isVisible={true}
        onClose={() => {}}
        name={props.name}
      />
    ),
  }
);
