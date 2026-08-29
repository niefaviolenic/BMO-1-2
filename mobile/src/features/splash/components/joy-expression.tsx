import { Image } from 'expo-image';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { SplashTokens } from '@/constants/theme';

export type JoyExpressionProps = Pick<ViewProps, 'style' | 'testID'>;

export function JoyExpression({ style, testID = 'splash-joy-expression' }: JoyExpressionProps) {
  return (
    <View collapsable={false} style={[styles.frame, style]} testID={testID}>
      <Image
        accessible={false}
        contentFit="contain"
        source={require('@/assets/images/chat/expressions/expression-default.svg')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: SplashTokens.expressionSize,
    height: SplashTokens.expressionSize,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
