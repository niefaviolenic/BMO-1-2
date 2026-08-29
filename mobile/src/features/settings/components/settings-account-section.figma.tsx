import figma from '@figma/code-connect';

import { SettingsAccountSection } from './settings-account-section';

figma.connect(
  SettingsAccountSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136458',
  {
    props: {
      email: figma.string('Email'),
      subscription: figma.string('Subscription'),
    },
    example: (props) => (
      <SettingsAccountSection
        email={props.email}
        subscription={props.subscription}
      />
    ),
  }
);
