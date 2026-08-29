import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from './liquid-glass-back-button';
import { HeaderBarTokens } from '@/constants/theme';

export type HeaderBarProps = {
  title?: string;
  onBackPress?: () => void;
  onMorePress?: () => void;
  showBackButton?: boolean;
  showMoreButton?: boolean;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HeaderBar({
  title,
  onBackPress,
  onMorePress,
  showBackButton = true,
  showMoreButton = true,
  rightAction,
  style,
  testID = 'header-bar',
}: HeaderBarProps) {
  const theme = useTheme();
  const scaleMore = useRef(new Animated.Value(1)).current;
  const handleMorePressIn = () => {
    Animated.timing(scaleMore, {
      toValue: 0.92,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handleMorePressOut = () => {
    Animated.timing(scaleMore, {
      toValue: 1,
      duration: 100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.leftSlot}>
        {showBackButton && onBackPress ? (
          <LiquidGlassBackButton onPress={onBackPress} testID={`${testID}-back-button`} />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {title ? (
        <View style={styles.titleSlot}>
          <Text style={[styles.titleText, { color: theme.text }]} numberOfLines={1} testID={`${testID}-title`}>
            {title}
          </Text>
        </View>
      ) : null}

      <View style={styles.rightSlot}>
        {rightAction ? (
          rightAction
        ) : showMoreButton && onMorePress ? (
          <Pressable
            onPress={onMorePress}
            onPressIn={handleMorePressIn}
            onPressOut={handleMorePressOut}
            accessibilityRole="button"
            accessibilityLabel="More options"
            testID={`${testID}-more-button`}
          >
            <Animated.View
              style={[
                styles.moreButton,
                {
                  backgroundColor: theme.glassButtonBackground,
                  borderColor: theme.glassButtonBorder,
                },
                { transform: [{ scale: scaleMore }] },
              ]}
            >
              <View style={[styles.ellipsisDot, { backgroundColor: theme.icon }]} />
              <View style={[styles.ellipsisDot, { backgroundColor: theme.icon }]} />
              <View style={[styles.ellipsisDot, { backgroundColor: theme.icon }]} />
            </Animated.View>
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HeaderBarTokens.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  leftSlot: {
    width: HeaderBarTokens.buttonSize,
    height: HeaderBarTokens.buttonSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
 titleSlot: {
   flex: 1,
   alignItems: 'center',
   justifyContent: 'center',
   paddingHorizontal: 8,
 },
 titleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F1729',
   textAlign: 'center',
 },
 rightSlot: {
    width: HeaderBarTokens.buttonSize,
    height: HeaderBarTokens.buttonSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: HeaderBarTokens.buttonSize,
    height: HeaderBarTokens.buttonSize,
  },
  moreButton: {
    width: HeaderBarTokens.buttonSize,
    height: HeaderBarTokens.buttonSize,
    borderRadius: HeaderBarTokens.buttonRadius,
    backgroundColor: HeaderBarTokens.buttonBackground,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ellipsisDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: HeaderBarTokens.iconColor,
  },
});
