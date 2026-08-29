import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { TemporaryChatTokens } from '@/constants/theme';

export type TemporaryChatDeclarationProps = {
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function TemporaryChatDeclaration({
  title = 'Temporary Chat',
  subtitle = "This chat won't appear in history, use or update Joy memory, or be used to train our models. For safety purposes, we may keep a copy for up to 30 days.",
  style,
  testID = 'temporary-chat-declaration',
}: TemporaryChatDeclarationProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.title, { color: theme.text }]} testID={`${testID}-title`}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID={`${testID}-subtitle`}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: TemporaryChatTokens.gap,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: TemporaryChatTokens.titleFontSize,
    lineHeight: TemporaryChatTokens.titleLineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TemporaryChatTokens.subtitleFontSize,
    lineHeight: TemporaryChatTokens.subtitleLineHeight,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 340,
  },
});
