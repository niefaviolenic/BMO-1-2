import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatSearchTokens } from '@/constants/theme';

export type SearchNoResultsProps = {
  onNewChat: () => void;
  testID?: string;
};

export function SearchNoResults({
  onNewChat,
  testID = 'search-no-results',
}: SearchNoResultsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
        <Image
          source={require('@/assets/images/ui/icon-search.svg')}
          style={styles.icon}
          tintColor={theme.icon}
          contentFit="contain"
          accessibilityLabel="No results"
        />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>No results</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        {"You haven't had a conversation about this topic — yet."}
      </Text>
      <Pressable
        onPress={onNewChat}
        style={({ pressed }) => [styles.cta, { backgroundColor: theme.text }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        testID={`${testID}-new-chat`}
      >
        <Text style={[styles.ctaLabel, { color: theme.background }]}>New chat</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ChatSearchTokens.spacing.noResultsGap,
    paddingHorizontal: ChatSearchTokens.spacing.paddingHorizontal,
  },
  iconWrap: {
    width: ChatSearchTokens.sizes.iconTile,
    height: ChatSearchTokens.sizes.iconTile,
    borderRadius: ChatSearchTokens.sizes.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: {
    width: ChatSearchTokens.sizes.searchIcon,
    height: ChatSearchTokens.sizes.searchIcon,
  },
  title: {
    ...ChatSearchTokens.typography.noResultsTitle,
    textAlign: 'center',
  },
  subtitle: {
    ...ChatSearchTokens.typography.noResultsSubtitle,
    textAlign: 'center',
    maxWidth: 280,
  },
  cta: {
    marginTop: 8,
    borderRadius: ChatSearchTokens.sizes.ctaRadius,
    paddingHorizontal: ChatSearchTokens.sizes.ctaPaddingHorizontal,
    paddingVertical: ChatSearchTokens.sizes.ctaPaddingVertical,
  },
  pressed: {
    opacity: 0.8,
  },
  ctaLabel: {
    ...ChatSearchTokens.typography.cta,
  },
});
