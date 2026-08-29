import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatSearchTokens } from '@/constants/theme';

export type SearchEmptyStateProps = {
  testID?: string;
};

export function SearchEmptyState({ testID = 'search-empty-state' }: SearchEmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <Image
        source={require('@/assets/images/ui/icon-search.svg')}
        style={styles.icon}
        tintColor={theme.iconMuted}
        contentFit="contain"
        accessibilityLabel="Search"
      />
      <Text style={[styles.copy, { color: theme.textSecondary }]}>Search chats, files, and projects</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ChatSearchTokens.spacing.emptyGap,
    paddingHorizontal: ChatSearchTokens.spacing.paddingHorizontal,
  },
  icon: {
    width: ChatSearchTokens.sizes.emptyIcon,
    height: ChatSearchTokens.sizes.emptyIcon,
    opacity: 0.7,
  },
  copy: {
    ...ChatSearchTokens.typography.emptyCopy,
    textAlign: 'center',
  },
});
