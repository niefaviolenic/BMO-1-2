import { Bell, CircleMinus, Pin, PinOff, RefreshCw, Trash2 } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme, type ThemePalette } from "@/hooks/use-theme";
import { DropdownMenuTokens } from "@/constants/theme";
export type DropdownMenuItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  iconName?: "refresh-cw" | "bell" | "circle-minus" | "pin" | "pin-off" | "trash-2" | "trash" | string;
  isDestructive?: boolean;
  onPress: () => void;
  showDivider?: boolean;
  rightAccessory?: React.ReactNode;
};

export type DropdownMenuProps = {
  items: DropdownMenuItem[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
function renderItemIcon(item: DropdownMenuItem, theme: ThemePalette) {
  if (item.icon) {
    return item.icon;
  }
  if (!item.iconName) {
    return null;
  }

  const color = item.isDestructive
    ? DropdownMenuTokens.destructiveColor
    : theme.text;
  if (item.iconName === "refresh-cw") {
    return <RefreshCw size={18} color={color} strokeWidth={1.5} />;
  }
  if (item.iconName === "bell") {
    return <Bell size={18} color={color} strokeWidth={1.5} />;
  }
  if (item.iconName === "circle-minus") {
    return <CircleMinus size={18} color={color} strokeWidth={1.5} />;
  }
  if (item.iconName === "pin") {
    return <Pin size={18} color={color} strokeWidth={1.5} />;
  }
  if (item.iconName === "pin-off") {
    return <PinOff size={18} color={color} strokeWidth={1.5} />;
  }
  if (item.iconName === "trash-2" || item.iconName === "trash") {
    return <Trash2 size={18} color={color} strokeWidth={1.5} />;
  }

  return null;
}

export function DropdownMenu({
  items,
  style,
  testID = "dropdown-menu",
}: DropdownMenuProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.shadowContainer,
        {
          backgroundColor: theme.dropdownBackground,
          borderColor: theme.dropdownBorder,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.contentContainer}>
        {items.map((item, index) => (
          <View key={item.id}>
            {item.showDivider && index > 0 ? (
              <View style={styles.divider} accessibilityElementsHidden />
            ) : null}
            <Pressable
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              testID={`${testID}-item-${item.id}`}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={styles.itemContent}>
                <View style={styles.iconWrapper}>
                  {renderItemIcon(item, theme)}
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: theme.text },
                    item.isDestructive && styles.destructiveLabel,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.rightAccessory ? (
                  <View style={styles.rightAccessoryWrapper}>
                    {item.rightAccessory}
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    width: DropdownMenuTokens.width,
    backgroundColor: DropdownMenuTokens.background,
    borderRadius: DropdownMenuTokens.containerRadius,
    shadowColor: DropdownMenuTokens.shadowColor,
    shadowOffset: DropdownMenuTokens.shadowOffset,
    shadowOpacity: DropdownMenuTokens.shadowOpacity,
    shadowRadius: DropdownMenuTokens.shadowRadius,
    elevation: DropdownMenuTokens.elevation,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  contentContainer: {
    width: "100%",
    borderRadius: DropdownMenuTokens.containerRadius,
    overflow: "hidden",
  },
  item: {
    height: DropdownMenuTokens.itemHeight,
    paddingHorizontal: DropdownMenuTokens.paddingHorizontal,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrapper: {
    width: DropdownMenuTokens.iconSize,
    height: DropdownMenuTokens.iconSize,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    flex: 1,
    fontSize: DropdownMenuTokens.labelFontSize,
    lineHeight: DropdownMenuTokens.labelLineHeight,
    fontWeight: "400",
    color: DropdownMenuTokens.labelColor,
    flexShrink: 1,
  },
  rightAccessoryWrapper: {
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveLabel: {
    color: DropdownMenuTokens.destructiveColor,
  },
  divider: {
    height: DropdownMenuTokens.dividerHeight,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
});
