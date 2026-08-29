import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type BottomWhiteFadeOverlayProps = {
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Bottom Fade Overlay component matching Figma fade overlay specs.
 * Fades from solid background at bottom to transparent at top so messages scrolling into composer area fade out smoothly.
 */
export function BottomWhiteFadeOverlay({
  height = 90,
  color,
  style,
  testID = 'bottom-white-fade-overlay',
}: BottomWhiteFadeOverlayProps) {
  const theme = useTheme();
  const fadeColor = color ?? theme.overlayFadeStart;

  return (
    <View style={[styles.container, { height }, style]} pointerEvents="none" testID={testID}>
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="bottomWhiteFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={fadeColor} stopOpacity="0" />
            <Stop offset="35%" stopColor={fadeColor} stopOpacity="0.4" />
            <Stop offset="70%" stopColor={fadeColor} stopOpacity="0.85" />
            <Stop offset="100%" stopColor={fadeColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomWhiteFadeGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
});
