/* eslint-disable import/no-unresolved */
// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getChatById,
  getLastOpenedChats,
  getLastOpenedIds,
  markChatOpened,
  resetChatSearchStoreForTest,
  searchChats,
  subscribeChatSearch,
} from './chat-search-store';

vi.mock('./chat-session-store', () => {
  let mockState = {
    sessions: [
      { id: 'session-1', title: 'React Native Tutorial', temporary: false },
      { id: 'session-2', title: 'Cooking Carbonara', temporary: false },
      { id: 'session-3', title: 'Code Review Joy', temporary: false },
    ],
    activeSessionId: null,
    messages: [],
    isThinking: false,
    isTemporary: false,
    isSending: false,
    feedbackByMessageId: {},
  };

  return {
    getChatSessionState: () => mockState,
    sessionToThread: (session: { id: string; title: string }) => ({
      id: session.id,
      title: session.title,
      snippet: '',
    }),
    subscribeChatSession: vi.fn(),
  };
});

describe('chat-search-store', () => {
  beforeEach(() => {
    resetChatSearchStoreForTest();
  });

  it('maintains referential stability for getLastOpenedChats when unchanged', () => {
    const firstCall = getLastOpenedChats();
    const secondCall = getLastOpenedChats();
    expect(firstCall).toBe(secondCall);
  });

  it('searches chats by query matching title', () => {
    expect(searchChats('React')).toEqual([
      { id: 'session-1', title: 'React Native Tutorial', snippet: '' },
    ]);
    expect(searchChats('cook')).toEqual([
      { id: 'session-2', title: 'Cooking Carbonara', snippet: '' },
    ]);
    expect(searchChats('')).toEqual([]);
    expect(searchChats('   ')).toEqual([]);
    expect(searchChats('nonexistent')).toEqual([]);
  });

  it('retrieves chat by id', () => {
    expect(getChatById('session-2')).toEqual({
      id: 'session-2',
      title: 'Cooking Carbonara',
      snippet: '',
    });
    expect(getChatById('unknown')).toBeUndefined();
  });

  it('marks chat opened and updates cached last opened chats in correct order', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChatSearch(listener);

    markChatOpened('session-1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLastOpenedIds()).toEqual(['session-1']);
    expect(getLastOpenedChats()).toEqual([
      { id: 'session-1', title: 'React Native Tutorial', snippet: '' },
    ]);

    const afterFirst = getLastOpenedChats();
    expect(getLastOpenedChats()).toBe(afterFirst);

    markChatOpened('session-2');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getLastOpenedIds()).toEqual(['session-2', 'session-1']);
    expect(getLastOpenedChats()).toEqual([
      { id: 'session-2', title: 'Cooking Carbonara', snippet: '' },
      { id: 'session-1', title: 'React Native Tutorial', snippet: '' },
    ]);

    // Re-marking session-1 brings it to the front
    markChatOpened('session-1');
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getLastOpenedIds()).toEqual(['session-1', 'session-2']);
    expect(getLastOpenedChats()).toEqual([
      { id: 'session-1', title: 'React Native Tutorial', snippet: '' },
      { id: 'session-2', title: 'Cooking Carbonara', snippet: '' },
    ]);

    unsubscribe();
    markChatOpened('session-3');
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
