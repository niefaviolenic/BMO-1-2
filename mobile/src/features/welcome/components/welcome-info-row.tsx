import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';
export type WelcomeInfoRowProps = {
  icon: number | string;
  title: string;
  description: string;
  testID?: string;
};

export function WelcomeInfoRow({ icon, title, description, testID }: WelcomeInfoRowProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconContainer}>
        <Image
          source={icon}
          style={styles.icon}
          tintColor={theme.icon}
          contentFit="contain"
          accessibilityLabel={`${title} icon`}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: WelcomeTokens.spacing.infoRowGap,
    alignSelf: 'stretch',
  },
  iconContainer: {
    width: WelcomeTokens.spacing.iconSize,
    height: WelcomeTokens.spacing.iconSize,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    width: WelcomeTokens.spacing.iconSize,
    height: WelcomeTokens.spacing.iconSize,
  },
  textContainer: {
    flex: 1,
    gap: WelcomeTokens.spacing.textGap,
  },
  title: {
    color: WelcomeTokens.colors.textPrimary,
    fontSize: WelcomeTokens.typography.rowTitle.fontSize,
    fontWeight: WelcomeTokens.typography.rowTitle.fontWeight,
    lineHeight: WelcomeTokens.typography.rowTitle.lineHeight,
  },
  description: {
    color: WelcomeTokens.colors.textDescription,
    fontSize: WelcomeTokens.typography.rowDescription.fontSize,
    fontWeight: WelcomeTokens.typography.rowDescription.fontWeight,
    lineHeight: WelcomeTokens.typography.rowDescription.lineHeight,
  },
});
