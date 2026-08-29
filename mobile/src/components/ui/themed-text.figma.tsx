import figma from '@figma/code-connect'
import { ThemedText } from './themed-text'

figma.connect(
  ThemedText,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=824-6247',
  {
    props: {
      type: figma.enum('Type', {
        default: 'default',
        title: 'title',
        subtitle: 'subtitle',
        link: 'link',
        code: 'code',
      }),
    },
    example: ({ type }) => (
      <ThemedText type={type}>Sample Text</ThemedText>
    ),
  }
)
