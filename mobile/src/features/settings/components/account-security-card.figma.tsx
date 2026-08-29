import figma from '@figma/code-connect';

import { AccountSecurityCard } from './account-security-card';

figma.connect(
  AccountSecurityCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-137962',
  {
    props: {
      email: figma.string('denisemcguire838@gmail.com'),
      phone: figma.string('+6285137440310'),
      password: figma.string('••••••••'),
    },
    example: (props) => (
      <AccountSecurityCard
        email={props.email}
        phone={props.phone}
        password={props.password}
      />
    ),
  }
);
