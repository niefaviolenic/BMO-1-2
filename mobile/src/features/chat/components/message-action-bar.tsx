import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Copy, Volume2, VolumeX, ThumbsDown, Share } from 'lucide-react-native';
import { MessageActionBarTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type MessageActionBarProps = {
  onCopy?: () => void;
  onSpeak?: () => void;
  onThumbsDown?: () => void;
  onShare?: () => void;
  thumbsDownSelected?: boolean;
  isSpeaking?: boolean;
  isLoadingSpeech?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function IconButton({
  onPress = () => {},
  accessibilityLabel,
  accessibilityState,
  testID,
  children,
}: {
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityState?: { busy?: boolean; selected?: boolean };
  testID: string;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.85,
      duration: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 80,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
    >
      <Animated.View style={[styles.iconButtonContainer, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function MessageActionBar({
  onCopy = () => {},
  onSpeak = () => {},
  onThumbsDown = () => {},
  onShare = () => {},
  thumbsDownSelected = false,
  isSpeaking = false,
  isLoadingSpeech = false,
  style,
  testID = 'message-action-bar',
}: MessageActionBarProps) {
  const theme = useTheme();
  const iconSize = MessageActionBarTokens.iconSize;
  const iconColor = theme.iconMuted;
  const activeColor = theme.linkPrimary;
  const thumbsDownColor = thumbsDownSelected ? theme.text : iconColor;
  const strokeWidth = MessageActionBarTokens.strokeWidth;
  const speakAccessibilityLabel = isLoadingSpeech
    ? 'Synthesizing speech...'
    : isSpeaking
      ? 'Stop reading'
      : 'Read aloud';

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Copy Icon */}
      <IconButton onPress={onCopy} accessibilityLabel="Copy message" testID={`${testID}-copy`}>
        <Copy size={iconSize} color={iconColor} strokeWidth={strokeWidth} />
      </IconButton>

      {/* Speak / Volume Icon */}
      <IconButton
        onPress={onSpeak}
        accessibilityLabel={speakAccessibilityLabel}
        accessibilityState={{ busy: isLoadingSpeech }}
        testID={`${testID}-speak`}
      >
        {isLoadingSpeech ? (
          <ActivityIndicator
            size="small"
            color={activeColor}
            style={styles.spinner}
            testID={`${testID}-speak-loading`}
          />
        ) : isSpeaking ? (
          <VolumeX size={iconSize} color={activeColor} strokeWidth={strokeWidth} />
        ) : (
          <Volume2 size={iconSize} color={iconColor} strokeWidth={strokeWidth} />
        )}
      </IconButton>

      {/* Thumbs Down Icon */}
      <IconButton
        onPress={onThumbsDown}
        accessibilityLabel="Bad response"
        testID={`${testID}-thumbs-down`}
      >
        <ThumbsDown size={iconSize} color={thumbsDownColor} strokeWidth={strokeWidth} />
      </IconButton>

      {/* Share Icon */}
      <IconButton onPress={onShare} accessibilityLabel="Share response" testID={`${testID}-share`}>
        <Share size={iconSize} color={iconColor} strokeWidth={strokeWidth} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MessageActionBarTokens.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: MessageActionBarTokens.itemSpacing,
    paddingVertical: MessageActionBarTokens.paddingVertical,
  },
  iconButtonContainer: {
    width: MessageActionBarTokens.iconSize,
    height: MessageActionBarTokens.iconSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: MessageActionBarTokens.iconSize,
    height: MessageActionBarTokens.iconSize,
    transform: [{ scale: 0.8 }],
  },
});
