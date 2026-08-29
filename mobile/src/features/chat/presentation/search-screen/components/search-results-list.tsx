import { StyleSheet, View } from 'react-native';

import { ChatSearchTokens } from '@/constants/theme';
import type { ChatThread } from '@/features/chat/domain/chat-thread';

import { SearchResultItem } from './search-result-item';

export type SearchResultsListProps = {
  items: ChatThread[];
  query: string;
  onPressItem: (chat: ChatThread) => void;
  testID?: string;
};

export function SearchResultsList({
  items,
  query,
  onPressItem,
  testID = 'search-results-list',
}: SearchResultsListProps) {
  return (
    <View style={styles.container} testID={testID}>
      {items.map((chat) => (
        <SearchResultItem
          key={chat.id}
          chat={chat}
          query={query}
          variant="result"
          onPress={onPressItem}
          testID={`${testID}-item-${chat.id}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: ChatSearchTokens.spacing.sectionTop,
    gap: ChatSearchTokens.spacing.listGap,
  },
});
