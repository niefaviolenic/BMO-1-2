import figma from '@figma/code-connect';

import { SettingsThemeSection } from './settings-theme-section';

figma.connect(
  SettingsThemeSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-136487',
  {
    props: {
      appearanceValue: figma.string('Appearance'),
      accentColorLabel: figma.string('Accent color'),
    },
    example: (props) => (
      <SettingsThemeSection
        appearanceValue={props.appearanceValue}
        accentColorLabel={props.accentColorLabel}
      />
    ),
  }
);
