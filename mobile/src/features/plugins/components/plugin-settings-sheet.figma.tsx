import React from 'react';
import figma from '@figma/code-connect';
import { PluginSettingsSheet } from './plugin-settings-sheet';

figma.connect(
  PluginSettingsSheet,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135057',
  {
    props: {
      pluginTitle: figma.string('WhatsApp'),
    },
    example: (props) => (
      <PluginSettingsSheet
        isVisible={true}
        onClose={() => {}}
        pluginTitle={props.pluginTitle}
      />
    ),
  }
);
