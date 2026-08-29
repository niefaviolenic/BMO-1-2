import figma from "@figma/code-connect";
import { LiquidGlassBackButton } from "./liquid-glass-back-button";

figma.connect(
  LiquidGlassBackButton,
  "https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=824-6280",
  {
    example: () => <LiquidGlassBackButton onPress={() => {}} />,
  }
);
