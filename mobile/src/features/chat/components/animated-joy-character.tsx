import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export const JOY_EXPRESSIONS = [
  require('@/assets/images/chat/expressions/expression-default.svg'),
  require('@/assets/images/chat/expressions/expression-blink.svg'),
  require('@/assets/images/chat/expressions/expression-happy.svg'),
  require('@/assets/images/chat/expressions/expression-wink.svg'),
  require('@/assets/images/chat/expressions/expression-surprised.svg'),
  require('@/assets/images/chat/expressions/expression-talking.svg'),
  require('@/assets/images/chat/expressions/expression-looking-side.svg'),
  require('@/assets/images/chat/expressions/expression-sad.svg'),
] as const;

export type AnimatedJoyCharacterProps = {
  size?: number;
  intervalMs?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AnimatedJoyCharacter({
  size = 72,
  intervalMs = 1500,
  style,
  testID = 'animated-joy-character',
}: AnimatedJoyCharacterProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % JOY_EXPRESSIONS.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  const frameStyle = { width: size, height: size };

  return (
    <View style={[styles.container, frameStyle, style]} testID={testID}>
      <Image
        source={JOY_EXPRESSIONS[currentIndex]}
        style={styles.image}
        contentFit="contain"
        accessibilityLabel="Joy Character Expression"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
