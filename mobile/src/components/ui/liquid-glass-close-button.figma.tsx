import figma from "@figma/code-connect";
import { LiquidGlassCloseButton } from "./liquid-glass-close-button";

figma.connect(
  LiquidGlassCloseButton,
  "https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=824-6282",
  {
    example: () => <LiquidGlassCloseButton onPress={() => {}} />,
  }
);
