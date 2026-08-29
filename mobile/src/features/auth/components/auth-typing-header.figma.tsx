import figma from '@figma/code-connect'
import { AuthTypingHeader } from './auth-typing-header'

figma.connect(
  AuthTypingHeader,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=824-1843',
  {
    example: () => (
      <AuthTypingHeader delayMs={1000} />
    ),
  }
)
