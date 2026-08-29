import figma from '@figma/code-connect'
import { ThemedView } from './themed-view'

figma.connect(
  ThemedView,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=824-6254',
  {
    props: {
      type: figma.enum('Type', {
        background: 'background',
        backgroundElement: 'backgroundElement',
        backgroundSelected: 'backgroundSelected',
      }),
    },
    example: ({ type }) => <ThemedView type={type} />,
  }
)
