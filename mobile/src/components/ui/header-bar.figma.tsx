import figma from '@figma/code-connect';
import { HeaderBar } from './header-bar';

figma.connect(
  HeaderBar,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133293',
  {
    props: {},
    example: () => <HeaderBar onBackPress={() => {}} onMorePress={() => {}} />,
  }
);
