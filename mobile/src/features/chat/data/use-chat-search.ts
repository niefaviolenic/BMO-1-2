import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { ChatThread } from '@/features/chat/domain/chat-thread';

import { searchChatMessages } from './chat-api';
import {
  getLastOpenedChats,
  markChatOpened,
  searchChats,
  subscribeChatSearch,
} from './chat-search-store';

const SEARCH_DEBOUNCE_MS = 300;

export type UseChatSearchResult = {
  query: string;
  setQuery: (value: string) => void;
  results: ChatThread[];
  isLoading: boolean;
  lastOpened: ChatThread[];
  markOpened: (chatId: string) => void;
};

export function useChatSearch(): UseChatSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lastOpened = useSyncExternalStore(
    subscribeChatSearch,
    getLastOpenedChats,
    getLastOpenedChats
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const remoteResults = await searchChatMessages(trimmed);
        if (!isCancelled) {
          setResults(remoteResults);
        }
      } catch {
        if (!isCancelled) {
          setResults(searchChats(trimmed));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const markOpened = useCallback((chatId: string) => {
    markChatOpened(chatId);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    lastOpened,
    markOpened,
  };
}

export { markChatOpened };
