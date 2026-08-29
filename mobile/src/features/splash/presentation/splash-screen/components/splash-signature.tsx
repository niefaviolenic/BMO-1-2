import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, SplashTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SplashSignatureProps = Pick<TextProps, 'style' | 'testID'>;

export function SplashSignature({
  style,
  testID = 'splash-signature',
}: SplashSignatureProps) {
  const theme = useTheme();

  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[styles.text, { color: theme.text }, style]}
      testID={testID}>
      From Biner Labs
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: SplashTokens.colors.foreground,
    fontFamily: Fonts?.sans,
    fontSize: SplashTokens.signature.fontSize,
    fontWeight: '400',
    lineHeight: SplashTokens.signature.lineHeight,
    textAlign: 'center',
  },
});
