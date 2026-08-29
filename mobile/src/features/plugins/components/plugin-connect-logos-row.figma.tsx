import figma from '@figma/code-connect'
import { PluginConnectLogosRow } from './plugin-connect-logos-row'

figma.connect(
  PluginConnectLogosRow,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-134102',
  {
    example: () => <PluginConnectLogosRow />,
  }
)
