import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatSearchTokens } from '@/constants/theme';
import type { ChatThread } from '@/features/chat/domain/chat-thread';

import { SearchResultItem } from './search-result-item';

export type SearchHistorySectionProps = {
  items: ChatThread[];
  onPressItem: (chat: ChatThread) => void;
  testID?: string;
};

export function SearchHistorySection({
  items,
  onPressItem,
  testID = 'search-history-section',
}: SearchHistorySectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.title, { color: theme.text }]}>Last opened</Text>
      <View style={styles.list}>
        {items.map((chat) => (
          <SearchResultItem
            key={chat.id}
            chat={chat}
            variant="result"
            onPress={onPressItem}
            testID={`${testID}-item-${chat.id}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: ChatSearchTokens.spacing.sectionTop,
  },
  title: {
    ...ChatSearchTokens.typography.sectionTitle,
    paddingHorizontal: ChatSearchTokens.spacing.paddingHorizontal,
    marginBottom: ChatSearchTokens.spacing.listGap,
  },
  list: {
    gap: ChatSearchTokens.spacing.listGap,
  },
});
