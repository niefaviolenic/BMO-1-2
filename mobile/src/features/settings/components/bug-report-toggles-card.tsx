import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Toggle } from "@/components/ui/toggle";
import { SettingsTokens } from "@/constants/theme";
import { ScreenshotUploadContainer } from "./screenshot-upload-container";

export interface BugReportTogglesCardProps {
  /** Whether screenshot is included in report. Defaults to false. */
  includeScreenshot?: boolean;
  /** Callback when toggle switch is flipped. */
  onIncludeScreenshotChange?: (value: boolean) => void;
  /** Label for the toggle row. Defaults to 'Include screenshot in report'. */
  label?: string;
  /** Callback when Add Screenshot button is pressed. */
  onAddScreenshot?: () => void;
  /** List of screenshot image URIs or assets. */
  screenshots?: string[];
  /** Callback when remove screenshot is pressed. */
  onRemoveScreenshot?: (index: number) => void;
  /** Maximum number of screenshots allowed before hiding the add button. */
  maxScreenshots?: number;
  /** Optional container style override. */
  style?: StyleProp<ViewStyle>;
  /** Optional test ID for automation. */
  testID?: string;
}

export function BugReportTogglesCard({
  includeScreenshot = false,
  onIncludeScreenshotChange,
  label = "Include screenshot in report",
  onAddScreenshot,
  screenshots = [],
  onRemoveScreenshot,
  maxScreenshots,
  style,
  testID = "bug-report-toggles-card",
}: BugReportTogglesCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderRadius: includeScreenshot
            ? SettingsTokens.bugReportTogglesCard.borderRadius
            : SettingsTokens.bugReportTogglesCard.borderRadiusCollapsed,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.row} testID={`${testID}-toggle-row`}>
        <Text style={[styles.rowLabel, { color: theme.text }]} testID={`${testID}-label`}>
          {label}
        </Text>
        <Toggle
          value={includeScreenshot}
          onValueChange={onIncludeScreenshotChange}
          testID={`${testID}-toggle`}
        />
      </View>

      {includeScreenshot && (
        <ScreenshotUploadContainer
          screenshots={screenshots}
          onAddScreenshot={onAddScreenshot}
          onRemoveScreenshot={onRemoveScreenshot}
          maxScreenshots={maxScreenshots}
          testID={`${testID}-upload-container`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: SettingsTokens.bugReportTogglesCard.width,
    backgroundColor: SettingsTokens.bugReportTogglesCard.backgroundColor,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SettingsTokens.bugReportTogglesCard.paddingHorizontal,
    paddingVertical: SettingsTokens.bugReportTogglesCard.rowPaddingVertical,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: SettingsTokens.bugReportTogglesCard.textFontSize,
    lineHeight: SettingsTokens.bugReportTogglesCard.textLineHeight,
    color: SettingsTokens.bugReportTogglesCard.textColor,
    fontWeight: "400",
  },
});
