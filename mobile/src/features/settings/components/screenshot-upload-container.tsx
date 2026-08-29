import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";

import { useTheme } from "@/hooks/use-theme";
import { SettingsTokens } from "@/constants/theme";
export interface ScreenshotUploadContainerProps {
  /** List of screenshot image URIs or assets. */
  screenshots?: string[];
  /** Callback when Add Screenshot button is pressed. */
  onAddScreenshot?: () => void;
  /** Callback when remove button on a thumbnail is pressed. */
  onRemoveScreenshot?: (index: number) => void;
  /** Maximum number of screenshots allowed before hiding the add button. */
  maxScreenshots?: number;
  /** Optional style override for the container. */
  style?: StyleProp<ViewStyle>;
  /** Optional test ID for automation. */
  testID?: string;
}

export function ScreenshotUploadContainer({
  screenshots = [],
  onAddScreenshot,
  onRemoveScreenshot,
  maxScreenshots,
  style,
  testID = "screenshot-upload-container",
}: ScreenshotUploadContainerProps) {
  const theme = useTheme();
  const canAddMore = !maxScreenshots || screenshots.length < maxScreenshots;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {screenshots.map((uri, index) => (
        <View
          key={`screenshot-${index}`}
          style={[
            styles.thumbnailContainer,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          testID={`${testID}-thumbnail-${index}`}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.thumbnailImage}
              contentFit="cover"
              testID={`${testID}-image-${index}`}
            />
          ) : (
            <MockScreenshotThumbnail />
          )}

          {onRemoveScreenshot && (
            <Pressable
              style={({ pressed }) => [
                styles.removeButton,
                pressed && styles.removeButtonPressed,
              ]}
              onPress={() => onRemoveScreenshot(index)}
              accessibilityRole="button"
              accessibilityLabel={`Remove screenshot ${index + 1}`}
              testID={`${testID}-remove-button-${index}`}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}

      {canAddMore && (
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
            pressed && styles.addButtonPressed,
          ]}
          onPress={onAddScreenshot}
          accessibilityRole="button"
          accessibilityLabel="Add Screenshot"
          testID={`${testID}-add-button`}
        >
          <PlusIcon color={theme.text} />
        </Pressable>
      )}
    </View>
  );
}

function MockScreenshotThumbnail() {
  return (
    <View style={styles.mockContainer}>
      <View style={styles.mockHeader} />
      <View style={styles.mockCard1} />
      <View style={styles.mockCard2} />
      <View style={styles.mockLine} />
    </View>
  );
}

function PlusIcon({ color }: { color?: string }) {
  return (
    <View style={styles.plusIconWrapper}>
      <View style={[styles.plusHorizontalBar, color ? { backgroundColor: color } : null]} />
      <View style={[styles.plusVerticalBar, color ? { backgroundColor: color } : null]} />
    </View>
  );
}

const tokens = SettingsTokens.screenshotUploadContainer;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: tokens.width,
    paddingTop: tokens.paddingTop,
    paddingBottom: tokens.paddingBottom,
    paddingHorizontal: tokens.paddingHorizontal,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.gap,
  },
  thumbnailContainer: {
    width: tokens.thumbnailSize,
    height: tokens.thumbnailSize,
    borderRadius: tokens.thumbnailRadius,
    backgroundColor: tokens.thumbnailBackground,
    borderWidth: tokens.thumbnailBorderWidth,
    borderColor: tokens.thumbnailBorderColor,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  mockContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: tokens.thumbnailBackground,
    alignItems: "center",
  },
  mockHeader: {
    width: 72,
    height: 16,
    backgroundColor: "#3873EC",
  },
  mockCard1: {
    width: 56,
    height: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    marginTop: 6,
  },
  mockCard2: {
    width: 56,
    height: 26,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    marginTop: 4,
  },
  mockLine: {
    width: 36,
    height: 4,
    backgroundColor: "#CCCFE0",
    borderRadius: 2,
    marginTop: 2,
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: tokens.removeButtonSize,
    height: tokens.removeButtonSize,
    borderRadius: tokens.removeButtonRadius,
    backgroundColor: tokens.removeButtonBackground,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  removeButtonPressed: {
    opacity: 0.7,
  },
  removeButtonText: {
    color: tokens.removeButtonTextColor,
    fontSize: tokens.removeButtonFontSize,
    fontWeight: "700",
    lineHeight: tokens.removeButtonFontSize + 2,
    textAlign: "center",
  },
  addButton: {
    width: tokens.buttonSize,
    height: tokens.buttonSize,
    backgroundColor: tokens.buttonBackground,
    borderRadius: tokens.buttonRadius,
    borderWidth: tokens.buttonBorderWidth,
    borderColor: tokens.buttonBorderColor,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  plusIconWrapper: {
    width: tokens.plusIconSize,
    height: tokens.plusIconSize,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  plusHorizontalBar: {
    position: "absolute",
    width: 14,
    height: 1.8,
    backgroundColor: tokens.plusIconColor,
    borderRadius: 1,
    top: 10.1,
  },
  plusVerticalBar: {
    position: "absolute",
    width: 1.8,
    height: 14,
    backgroundColor: tokens.plusIconColor,
    borderRadius: 1,
    left: 10.1,
  },
});
