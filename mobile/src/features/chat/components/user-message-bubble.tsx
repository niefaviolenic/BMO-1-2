import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { UserMessageBubbleTokens } from '@/constants/theme';

export type UserMessageBubbleProps = {
  message: string;
  sourceDeviceId?: string | null;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function UserMessageBubble({
  message,
  sourceDeviceId,
  style,
  textStyle,
  testID = 'user-message-bubble',
}: UserMessageBubbleProps) {
  const theme = useTheme();
  const isFromRobot = Boolean(sourceDeviceId);

  return (
    <View style={[styles.bubble, { backgroundColor: theme.bubbleUser }, style]} testID={testID}>
      {isFromRobot ? (
        <View style={styles.robotHeader} testID={`${testID}-robot-badge`}>
          <Image
            source={require('@/assets/images/ui/icon-joy-robot.svg')}
            style={styles.robotIcon}
            contentFit="contain"
          />
          <Text style={[styles.robotBadgeText, { color: theme.bubbleUserText }]}>via Joy Robot</Text>
        </View>
      ) : null}
      <Text style={[styles.text, { color: theme.bubbleUserText }, textStyle]} testID={`${testID}-text`}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: UserMessageBubbleTokens.borderRadius,
    paddingVertical: UserMessageBubbleTokens.paddingVertical,
    paddingHorizontal: UserMessageBubbleTokens.paddingHorizontal,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  robotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    opacity: 0.75,
  },
  robotIcon: {
    width: 12,
    height: 12,
  },
  robotBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  text: {
    fontSize: UserMessageBubbleTokens.fontSize,
    fontWeight: '400',
    lineHeight: 20,
  },
});
