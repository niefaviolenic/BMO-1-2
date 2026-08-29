import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type TopWhiteFadeOverlayProps = {
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Top Fade Overlay component matching Figma node 611:133467.
 * Provides a top-to-bottom gradient fade overlay so scrolling chat text smoothly fades out under the header.
 */
export function TopWhiteFadeOverlay({
  height = 96,
  color,
  style,
  testID = 'top-white-fade-overlay',
}: TopWhiteFadeOverlayProps) {
  const theme = useTheme();
  const fadeColor = color ?? theme.overlayFadeStart;

  return (
    <View style={[styles.container, { height }, style]} pointerEvents="none" testID={testID}>
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="topWhiteFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={fadeColor} stopOpacity="1" />
            <Stop offset="40%" stopColor={fadeColor} stopOpacity="0.85" />
            <Stop offset="70%" stopColor={fadeColor} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={fadeColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#topWhiteFadeGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
});
