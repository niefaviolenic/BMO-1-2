import { Image } from "expo-image";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { CameraViewfinderBoxTokens } from "@/constants/theme";

export type CameraViewfinderBoxProps = {
  /** Callback triggered when pressing the flashlight button */
  onPressFlashlight?: () => void;
  /** Active status of the flashlight toggle */
  isFlashlightOn?: boolean;
  /** Whether to show the flashlight button (default: true) */
  showFlashlight?: boolean;
  /** Whether to render the horizontal scan target line (default: true) */
  showScanLine?: boolean;
  /** Whether to render the center icon or emoji (default: true) */
  showCenterIcon?: boolean;
  /** Custom center icon content (defaults to camera emoji 📷) */
  centerIcon?: React.ReactNode;
  /** Additional children rendered inside the viewfinder area */
  children?: React.ReactNode;
  /** Optional container style overrides */
  style?: StyleProp<ViewStyle>;
  /** Test identifier (default: "camera-viewfinder-box") */
  testID?: string;
};

export function CameraViewfinderBox({
  onPressFlashlight,
  isFlashlightOn = false,
  showFlashlight = true,
  showScanLine = true,
  showCenterIcon = true,
  centerIcon,
  children,
  style,
  testID = "camera-viewfinder-box",
}: CameraViewfinderBoxProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.frame} testID={`${testID}-frame`}>
        {showCenterIcon ? (
          <View style={styles.centerIconContainer} testID={`${testID}-center-icon`}>
            {centerIcon ?? <Text style={styles.cameraEmoji}>📷</Text>}
          </View>
        ) : null}

        {showScanLine ? <View style={styles.scanLine} testID={`${testID}-scan-line`} /> : null}

        {children}
      </View>

      {showFlashlight ? (
        <Pressable
          onPress={onPressFlashlight}
          accessibilityRole="button"
          accessibilityLabel="Toggle Flashlight"
          accessibilityState={{ selected: isFlashlightOn }}
          testID={`${testID}-flashlight-button`}
          hitSlop={8}
          style={({ pressed }) => [
            styles.flashlightButton,
            isFlashlightOn && styles.flashlightButtonActive,
            pressed && styles.flashlightButtonPressed,
          ]}
        >
          <Image
            source={require("@/assets/images/ui/icon-flashlight.svg")}
            style={styles.flashlightIcon}
            contentFit="contain"
            accessibilityLabel="Flashlight"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CameraViewfinderBoxTokens.width,
    height: CameraViewfinderBoxTokens.height,
    backgroundColor: CameraViewfinderBoxTokens.colors.background,
    borderRadius: CameraViewfinderBoxTokens.borderRadius,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
  },
  frame: {
    width: CameraViewfinderBoxTokens.frame.size,
    height: CameraViewfinderBoxTokens.frame.size,
    marginTop: CameraViewfinderBoxTokens.frame.top,
    borderWidth: CameraViewfinderBoxTokens.frame.borderWidth,
    borderColor: CameraViewfinderBoxTokens.colors.frameBorder,
    borderRadius: CameraViewfinderBoxTokens.frame.borderRadius,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  centerIconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  cameraEmoji: {
    fontSize: CameraViewfinderBoxTokens.centerIcon.fontSize,
    textAlign: "center",
  },
  scanLine: {
    position: "absolute",
    width: CameraViewfinderBoxTokens.scanLine.width,
    height: CameraViewfinderBoxTokens.scanLine.height,
    backgroundColor: CameraViewfinderBoxTokens.colors.scanLine,
    borderRadius: CameraViewfinderBoxTokens.scanLine.height / 2,
  },
  flashlightButton: {
    position: "absolute",
    right: CameraViewfinderBoxTokens.flashlightButton.right,
    bottom: CameraViewfinderBoxTokens.flashlightButton.bottom,
    width: CameraViewfinderBoxTokens.flashlightButton.size,
    height: CameraViewfinderBoxTokens.flashlightButton.size,
    borderRadius: CameraViewfinderBoxTokens.flashlightButton.borderRadius,
    backgroundColor: CameraViewfinderBoxTokens.colors.flashlightBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  flashlightButtonActive: {
    backgroundColor: CameraViewfinderBoxTokens.colors.flashlightBackgroundActive,
  },
  flashlightButtonPressed: {
    opacity: 0.7,
  },
  flashlightIcon: {
    width: CameraViewfinderBoxTokens.flashlightButton.iconSize,
    height: CameraViewfinderBoxTokens.flashlightButton.iconSize,
  },
});
