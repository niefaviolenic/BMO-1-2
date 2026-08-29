import figma from '@figma/code-connect';
import { DropdownMenu } from './dropdown-menu';

figma.connect(
  DropdownMenu,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-135373',
  {
    example: () => (
      <DropdownMenu
        items={[
          {
            id: 'refresh',
            label: 'Refresh',
            iconName: 'refresh-cw',
            onPress: () => {},
          },
          {
            id: 'notifications',
            label: 'Notifications',
            iconName: 'bell',
            onPress: () => {},
            showDivider: true,
          },
          {
            id: 'remove',
            label: 'Remove',
            iconName: 'circle-minus',
            isDestructive: true,
            onPress: () => {},
          },
        ]}
      />
    ),
  }
);
