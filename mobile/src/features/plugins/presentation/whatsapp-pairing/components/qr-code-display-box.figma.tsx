import figma from '@figma/code-connect';
import { QRCodeDisplayBox } from './qr-code-display-box';

figma.connect(
  QRCodeDisplayBox,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134862',
  {
    props: {
      expiresInSeconds: 599,
    },
    example: (props) => (
      <QRCodeDisplayBox expiresInSeconds={props.expiresInSeconds} />
    ),
  }
);
