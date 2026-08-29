import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontSizes, LineHeights, type ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'caption'
    | 'caption1'
    | 'caption2'
    | 'footnote'
    | 'subheadline'
    | 'body'
    | 'bodyMedium'
    | 'h3'
    | 'h2'
    | 'h1'
    | 'largeTitle';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const resolvedColor =
    themeColor !== undefined
      ? theme[themeColor]
      : type === 'linkPrimary'
        ? theme.linkPrimary
        : theme.text;

  return (
    <Text
      style={[
        { color: resolvedColor },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'caption' && styles.caption,
        type === 'caption1' && styles.caption1,
        type === 'caption2' && styles.caption2,
        type === 'footnote' && styles.footnote,
        type === 'subheadline' && styles.subheadline,
        type === 'body' && styles.body,
        type === 'bodyMedium' && styles.bodyMedium,
        type === 'h3' && styles.h3,
        type === 'h2' && styles.h2,
        type === 'h1' && styles.h1,
        type === 'largeTitle' && styles.largeTitle,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Semantic standard typography variants (Apple HIG / Material 3)
  caption: {
    fontSize: Typography.caption1.fontSize,
    lineHeight: Typography.caption1.lineHeight,
    fontWeight: Typography.caption1.fontWeight,
  },
  caption1: {
    fontSize: Typography.caption1.fontSize,
    lineHeight: Typography.caption1.lineHeight,
    fontWeight: Typography.caption1.fontWeight,
  },
  caption2: {
    fontSize: Typography.caption2.fontSize,
    lineHeight: Typography.caption2.lineHeight,
    fontWeight: Typography.caption2.fontWeight,
  },
  footnote: {
    fontSize: Typography.footnote.fontSize,
    lineHeight: Typography.footnote.lineHeight,
    fontWeight: Typography.footnote.fontWeight,
  },
  subheadline: {
    fontSize: Typography.subheadline.fontSize,
    lineHeight: Typography.subheadline.lineHeight,
    fontWeight: Typography.subheadline.fontWeight,
  },
  body: {
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    fontWeight: Typography.body.fontWeight,
  },
  bodyMedium: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    fontWeight: Typography.bodyMedium.fontWeight,
  },
  h3: {
    fontSize: Typography.title3.fontSize,
    lineHeight: Typography.title3.lineHeight,
    fontWeight: Typography.title3.fontWeight,
  },
  h2: {
    fontSize: Typography.title2.fontSize,
    lineHeight: Typography.title2.lineHeight,
    fontWeight: Typography.title2.fontWeight,
  },
  h1: {
    fontSize: Typography.title1.fontSize,
    lineHeight: Typography.title1.lineHeight,
    fontWeight: Typography.title1.fontWeight,
  },
  largeTitle: {
    fontSize: Typography.largeTitle.fontSize,
    lineHeight: Typography.largeTitle.lineHeight,
    fontWeight: Typography.largeTitle.fontWeight,
  },

  // Backwards-compatible existing variants
  small: {
    fontSize: Typography.subheadline.fontSize,
    lineHeight: Typography.subheadline.lineHeight,
    fontWeight: Typography.subheadline.fontWeight,
  },
  smallBold: {
    fontSize: Typography.subheadline.fontSize,
    lineHeight: Typography.subheadline.lineHeight,
    fontWeight: '700',
  },
  default: {
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    fontWeight: '500',
  },
  title: {
    fontSize: FontSizes['5xl'],
    fontWeight: '600',
    lineHeight: LineHeights['5xl'],
  },
  subtitle: {
    fontSize: 32,
    lineHeight: LineHeights['4xl'],
    fontWeight: '600',
  },
  link: {
    fontSize: Typography.subheadline.fontSize,
    lineHeight: 30,
  },
  linkPrimary: {
    fontSize: Typography.subheadline.fontSize,
    lineHeight: 30,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: Typography.caption1.fontSize,
  },
});
