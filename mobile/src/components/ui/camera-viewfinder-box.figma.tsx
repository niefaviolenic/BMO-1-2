import figma from "@figma/code-connect";
import { CameraViewfinderBox } from "./camera-viewfinder-box";

figma.connect(
  CameraViewfinderBox,
  "https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-138272",
  {
    props: {
      isFlashlightOn: figma.boolean("Flashlight Active", {
        true: true,
        false: false,
      }),
      showFlashlight: figma.boolean("Show Flashlight", {
        true: true,
        false: false,
      }),
      showScanLine: figma.boolean("Show Scan Line", {
        true: true,
        false: false,
      }),
    },
    example: (props) => (
      <CameraViewfinderBox
        isFlashlightOn={props.isFlashlightOn}
        showFlashlight={props.showFlashlight}
        showScanLine={props.showScanLine}
        onPressFlashlight={() => {}}
      />
    ),
  }
);
