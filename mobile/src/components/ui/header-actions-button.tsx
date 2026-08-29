import { Image } from "expo-image";
import { useRef } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { HeaderTokens } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type HeaderActionsButtonProps = {
  onPressEdit?: () => void;
  onPressNewSession?: () => void;
  onPressMore?: () => void;
  backgroundColor?: string;
  borderColor?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HeaderActionsButton({
  onPressEdit,
  onPressNewSession,
  onPressMore,
  style,
  testID = "header-actions-button",
  backgroundColor,
  borderColor,
  iconColor,
}: HeaderActionsButtonProps) {
  const theme = useTheme();
  const resolvedBg = backgroundColor ?? theme.glassButtonBackground;
  const resolvedBorder = borderColor ?? theme.glassButtonBorder;
  const resolvedIconColor = iconColor ?? theme.icon;
  const handleNewSessionPress = onPressNewSession ?? onPressEdit;
  const scaleEdit = useRef(new Animated.Value(1)).current;
  const opacityEdit = useRef(new Animated.Value(0)).current;

  const scaleMore = useRef(new Animated.Value(1)).current;
  const opacityMore = useRef(new Animated.Value(0)).current;

  const handleEditGrant = () => {
    Animated.parallel([
      Animated.timing(scaleEdit, {
        toValue: 1.62,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityEdit, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleEditRelease = (event: GestureResponderEvent) => {
    Animated.parallel([
      Animated.timing(scaleEdit, {
        toValue: 1,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacityEdit, {
        toValue: 0,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const { locationX, locationY } = event.nativeEvent;
    const hit = 4;
    const width = 44;
    const height = HeaderTokens.actionsButton.height;

    const isInside =
      locationX >= -hit &&
      locationX <= width + hit &&
      locationY >= -hit &&
      locationY <= height + hit;

    if (isInside && handleNewSessionPress) {
      handleNewSessionPress();
    }
  };

  const handleEditTerminate = () => {
    Animated.parallel([
      Animated.timing(scaleEdit, {
        toValue: 1,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacityEdit, {
        toValue: 0,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleMoreGrant = () => {
    Animated.parallel([
      Animated.timing(scaleMore, {
        toValue: 1.62,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityMore, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleMoreRelease = (event: GestureResponderEvent) => {
    Animated.parallel([
      Animated.timing(scaleMore, {
        toValue: 1,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacityMore, {
        toValue: 0,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const { locationX, locationY } = event.nativeEvent;
    const hit = 4;
    const width = 44;
    const height = HeaderTokens.actionsButton.height;

    const isInside =
      locationX >= -hit &&
      locationX <= width + hit &&
      locationY >= -hit &&
      locationY <= height + hit;

    if (isInside && onPressMore) {
      onPressMore();
    }
  };

  const handleMoreTerminate = () => {
    Animated.parallel([
      Animated.timing(scaleMore, {
        toValue: 1,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacityMore, {
        toValue: 0,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Base Layer: Single Static Unified Capsule */}
      <View
        style={[
          styles.baseCapsule,
          {
            backgroundColor: resolvedBg,
            borderColor: resolvedBorder,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.iconSlot}>
          <Image
            source={require("@/assets/images/ui/icon-edit.svg")}
            style={styles.icon}
            tintColor={resolvedIconColor}
            contentFit="contain"
            accessibilityLabel="New session"
          />
        </View>
        <View style={styles.iconSlot}>
          <Image
            source={require("@/assets/images/ui/icon-ellipsis.svg")}
            style={styles.icon}
            tintColor={resolvedIconColor}
            contentFit="contain"
            accessibilityLabel="More options"
          />
        </View>
      </View>

      {/* Overlay Layer: Interactive Touch Targets with Floating Rounded Scale Overlay */}
      <View style={styles.overlayRow}>
        <View
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleEditGrant}
          onResponderRelease={handleEditRelease}
          onResponderTerminate={handleEditTerminate}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="New session"
          testID={`${testID}-edit`}
          style={styles.touchTarget}
        >
          <Animated.View
            style={[
              styles.activePill,
              {
                backgroundColor: resolvedBg,
                borderColor: resolvedBorder,
                borderWidth: 1,
                opacity: opacityEdit,
                transform: [{ scale: scaleEdit }],
              },
            ]}
          >
            <Image
              source={require("@/assets/images/ui/icon-edit.svg")}
              style={styles.icon}
              tintColor={resolvedIconColor}
              contentFit="contain"
              accessibilityLabel="New session"
            />
          </Animated.View>
        </View>

        <View
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleMoreGrant}
          onResponderRelease={handleMoreRelease}
          onResponderTerminate={handleMoreTerminate}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="More options"
          testID={`${testID}-more`}
          style={styles.touchTarget}
        >
          <Animated.View
            style={[
              styles.activePill,
              {
                backgroundColor: resolvedBg,
                borderColor: resolvedBorder,
                borderWidth: 1,
                opacity: opacityMore,
                transform: [{ scale: scaleMore }],
              },
            ]}
          >
            <Image
              source={require("@/assets/images/ui/icon-ellipsis.svg")}
              style={styles.icon}
              tintColor={resolvedIconColor}
              contentFit="contain"
              accessibilityLabel="More options"
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 88,
    height: HeaderTokens.actionsButton.height,
    justifyContent: "center",
    alignItems: "center",
  },
  baseCapsule: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: HeaderTokens.actionsButton.borderRadius,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  iconSlot: {
    width: 44,
    height: HeaderTokens.actionsButton.height,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  touchTarget: {
    width: 44,
    height: HeaderTokens.actionsButton.height,
    justifyContent: "center",
    alignItems: "center",
  },
  activePill: {
    width: 44,
    height: HeaderTokens.actionsButton.height,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: HeaderTokens.actionsButton.borderRadius,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  icon: {
    width: HeaderTokens.actionsButton.iconSize,
    height: HeaderTokens.actionsButton.iconSize,
  },
});
