import figma from '@figma/code-connect';
import { PluginSkillsSection } from './plugin-skills-section';

figma.connect(
  PluginSkillsSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135083',
  {
    props: {},
    example: () => <PluginSkillsSection />,
  }
);
