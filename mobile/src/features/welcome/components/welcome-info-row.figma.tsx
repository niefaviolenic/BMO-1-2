import figma from '@figma/code-connect'
import { WelcomeInfoRow } from './welcome-info-row'

figma.connect(
  WelcomeInfoRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=824-1828',
  {
    example: () => (
      <WelcomeInfoRow
        title="Title"
        description="Description"
        icon={require('@/assets/images/welcome/icon-sparkle.svg')}
      />
    ),
  }
)
