import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
export type NotificationFilterMode = "selected" | "all";

export interface NotificationModeCardProps {
  selectedMode?: NotificationFilterMode;
  onSelectMode?: (mode: NotificationFilterMode) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const NotificationModeCardTokens = {
  layout: {
    width: 370,
    minHeight: 129,
    borderRadius: 16,
    paddingVertical: 8,
    rowHeight: 60,
    rowPaddingHorizontal: 16,
    radioSize: 20,
    radioInnerSize: 8,
  },
  colors: {
    cardBackground: "#FFFFFF",
    border: "#E3E8F0",
    divider: "#E5E5EB",
    title: "#0F1729",
    description: "#80808C",
    radioActive: "#0F1729",
    radioActiveDot: "#FFFFFF",
    radioInactive: "#BFBFC7",
  },
} as const;

function RadioIndicator({ checked }: { checked: boolean }) {
  return (
    <View
      style={[
        styles.radioOuter,
        checked ? styles.radioOuterActive : styles.radioOuterInactive,
      ]}
    >
      {checked ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

export function NotificationModeCard({
  selectedMode = "selected",
  onSelectMode,
  style,
  testID,
}: NotificationModeCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <Pressable
        style={styles.radioRow}
        onPress={() => onSelectMode?.("selected")}
        accessibilityRole="radio"
        accessibilityState={{ checked: selectedMode === "selected" }}
        testID={testID ? `${testID}-mode-selected` : undefined}
      >
        <RadioIndicator checked={selectedMode === "selected"} />
        <View style={styles.textColumn}>
          <Text
            style={[
              styles.titleText,
              { color: theme.textTitle },
              selectedMode === "selected"
                ? styles.titleSelected
                : styles.titleUnselected,
            ]}
          >
            Selected Contacts Only (Recommended)
          </Text>
          <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
            Only messages from allowed list trigger Joy Robot voice & face.
          </Text>
        </View>
      </Pressable>

      <View style={styles.dividerWrapper}>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
      </View>

      <Pressable
        style={styles.radioRow}
        onPress={() => onSelectMode?.("all")}
        accessibilityRole="radio"
        accessibilityState={{ checked: selectedMode === "all" }}
        testID={testID ? `${testID}-mode-all` : undefined}
      >
        <RadioIndicator checked={selectedMode === "all"} />
        <View style={styles.textColumn}>
          <Text
            style={[
              styles.titleText,
              { color: theme.textTitle },
              selectedMode === "all"
                ? styles.titleSelected
                : styles.titleUnselected,
            ]}
          >
            All Messages & Groups
          </Text>
          <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
            All incoming WhatsApp chats will be announced by Joy Robot.
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: NotificationModeCardTokens.layout.width,
    maxWidth: "100%",
    minHeight: NotificationModeCardTokens.layout.minHeight,
    backgroundColor: NotificationModeCardTokens.colors.cardBackground,
    borderRadius: NotificationModeCardTokens.layout.borderRadius,
    borderWidth: 1,
    borderColor: NotificationModeCardTokens.colors.border,
    paddingVertical: NotificationModeCardTokens.layout.paddingVertical,
    overflow: "hidden",
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: NotificationModeCardTokens.layout.rowHeight,
    paddingHorizontal: NotificationModeCardTokens.layout.rowPaddingHorizontal,
    gap: 12,
  },
  radioOuter: {
    width: NotificationModeCardTokens.layout.radioSize,
    height: NotificationModeCardTokens.layout.radioSize,
    borderRadius: NotificationModeCardTokens.layout.radioSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    backgroundColor: NotificationModeCardTokens.colors.radioActive,
    borderWidth: 0,
  },
  radioOuterInactive: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: NotificationModeCardTokens.colors.radioInactive,
  },
  radioInner: {
    width: NotificationModeCardTokens.layout.radioInnerSize,
    height: NotificationModeCardTokens.layout.radioInnerSize,
    borderRadius: NotificationModeCardTokens.layout.radioInnerSize / 2,
    backgroundColor: NotificationModeCardTokens.colors.radioActiveDot,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    fontSize: 14,
    color: NotificationModeCardTokens.colors.title,
  },
  titleSelected: {
    fontWeight: "600",
  },
  titleUnselected: {
    fontWeight: "500",
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: "400",
    color: NotificationModeCardTokens.colors.description,
    lineHeight: 16,
  },
  dividerWrapper: {
    width: "100%",
    paddingLeft: 48,
  },
  divider: {
    height: 1,
    backgroundColor: NotificationModeCardTokens.colors.divider,
  },
});
