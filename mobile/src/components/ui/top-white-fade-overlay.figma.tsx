import figma from '@figma/code-connect';
import { TopWhiteFadeOverlay } from './top-white-fade-overlay';

figma.connect(
  TopWhiteFadeOverlay,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-133467',
  {
    props: {},
    example: () => <TopWhiteFadeOverlay />,
  }
);
