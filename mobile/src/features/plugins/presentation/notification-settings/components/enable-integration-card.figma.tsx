import figma from '@figma/code-connect';
import { EnableIntegrationCard } from './enable-integration-card';

figma.connect(
  EnableIntegrationCard,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135752',
  {
    props: {
      enabled: figma.boolean('Enabled'),
    },
    example: (props) => (
      <EnableIntegrationCard enabled={props.enabled} />
    ),
  }
);
