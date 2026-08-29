import { useRouter } from 'expo-router';
import { useCallback, useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { ChatSearchTokens } from '@/constants/theme';
import { useChatSearch } from '@/features/chat/data/use-chat-search';
import { useChatSession } from '@/features/chat/data/use-chat-session';
import type { ChatThread } from '@/features/chat/domain/chat-thread';
import { SidebarShellContext } from '@/features/chat/presentation/sidebar-shell/sidebar-shell-context';
import {
  SearchBottomBar,
  SearchEmptyState,
  SearchHistorySection,
  SearchNoResults,
  SearchResultsList,
  SearchSkeletonList,
} from './components';

export type SearchScreenProps = {
  /** Dismiss the hosting overlay (Modal). Required — search is not a stack route. */
  onClose: () => void;
  testID?: string;
};

export function SearchScreen({ onClose, testID = 'search-screen' }: SearchScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { query, setQuery, results, isLoading, lastOpened, markOpened } = useChatSearch();
  const { openSession } = useChatSession();
  const sidebar = useContext(SidebarShellContext);

  const dismissThenGoChat = useCallback(() => {
    onClose();
    sidebar?.close();
    router.replace('/chat');
  }, [onClose, router, sidebar]);

  const handleOpenChat = useCallback(
    (chat: ChatThread) => {
      markOpened(chat.id);
      void openSession(chat.id);
      dismissThenGoChat();
    },
    [markOpened, openSession, dismissThenGoChat]
  );

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  let content: ReactNode;
  if (!hasQuery) {
    content =
      lastOpened.length > 0 ? (
        <SearchHistorySection items={lastOpened} onPressItem={handleOpenChat} />
      ) : (
        <SearchEmptyState />
      );
  } else if (isLoading) {
    content = <SearchSkeletonList />;
  } else if (results.length > 0) {
    content = (
      <SearchResultsList items={results} query={trimmedQuery} onPressItem={handleOpenChat} />
    );
  } else {
    content = <SearchNoResults onNewChat={dismissThenGoChat} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID={testID}
    >
      <View style={[styles.body, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
        <SearchBottomBar value={query} onChangeText={setQuery} onClose={onClose} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChatSearchTokens.colors.background,
  },
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
