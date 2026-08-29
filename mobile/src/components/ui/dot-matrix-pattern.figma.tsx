import figma from '@figma/code-connect';
import { DotMatrixPattern } from './dot-matrix-pattern';

figma.connect(
  DotMatrixPattern,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136828',
  {
    props: {},
    example: () => <DotMatrixPattern />,
  }
);
