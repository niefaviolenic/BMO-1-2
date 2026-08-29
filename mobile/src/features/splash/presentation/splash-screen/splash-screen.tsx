import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { SplashTokens } from '@/constants/theme';
import { JoyExpression } from '@/features/splash/components/joy-expression';
import { SplashSignature } from '@/features/splash/presentation/splash-screen/components/splash-signature';
export type SplashSection = 'expression' | 'signature' | 'full';

export type SplashScreenProps = {
  exposeTestMetrics?: boolean;
  section?: SplashSection;
  testID?: string;
};

export function SplashScreen({
  exposeTestMetrics = false,
  section = 'full',
  testID = 'splash-screen',
}: SplashScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const showExpression = section === 'expression' || section === 'full';
  const showSignature = section === 'signature' || section === 'full';
  const metrics = exposeTestMetrics
    ? `splash-metrics:${width}x${height};bottom=${insets.bottom}`
    : undefined;

  return (
    <View
      accessibilityLabel={metrics}
      collapsable={false}
      style={[styles.root, { backgroundColor: theme.background }]}
      testID={testID}>
      {showExpression ? <JoyExpression style={styles.expression} /> : null}
      {showSignature ? (
        <SplashSignature
          style={[
            styles.signature,
            { bottom: insets.bottom + SplashTokens.signature.safeAreaGap },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    inset: 0,
    backgroundColor: SplashTokens.colors.background,
  },
  expression: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -SplashTokens.expressionSize / 2,
    marginTop: -SplashTokens.expressionSize / 2,
  },
  signature: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
