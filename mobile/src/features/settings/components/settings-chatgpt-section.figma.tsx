import figma from '@figma/code-connect';
import { SettingsChatGPTSection } from './settings-chatgpt-section';

figma.connect(
  SettingsChatGPTSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136432',
  {
    props: {
      title: figma.string('Section Title'),
    },
    example: (props) => (
      <SettingsChatGPTSection
        title={props.title}
      />
    ),
  }
);
