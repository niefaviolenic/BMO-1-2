import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  deleteChatSession,
  getChatSessionState,
  openChatSession,
  sendActiveChatMessage,
  setTemporaryChat,
  startNewChat,
  submitNegativeFeedback,
  subscribeChatSession,
} from './chat-session-store';
import {
  getPinnedSessionIds,
  isSessionPinned,
  pinSession,
  subscribePinnedSessions,
  unpinSession,
} from './pinned-chat-store';

export function useChatSession() {
  const snapshot = useSyncExternalStore(
    subscribeChatSession,
    getChatSessionState,
    getChatSessionState,
  );
  const pinnedSessionIds = useSyncExternalStore(
    subscribePinnedSessions,
    getPinnedSessionIds,
    getPinnedSessionIds,
  );

  const sendMessage = useCallback(async (text: string) => {
    await sendActiveChatMessage(text);
  }, []);

  const startNew = useCallback((temporary = false) => {
    void startNewChat(temporary);
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    await openChatSession(sessionId);
  }, []);

  const setTemporary = useCallback((isTemporary: boolean) => {
    setTemporaryChat(isTemporary);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await deleteChatSession(sessionId);
  }, []);

  const dislikeMessage = useCallback(async (messageId: string) => {
    await submitNegativeFeedback(messageId);
  }, []);
  const pin = useCallback(async (sessionId: string) => {
    await pinSession(sessionId);
  }, []);

  const unpin = useCallback(async (sessionId: string) => {
    await unpinSession(sessionId);
  }, []);

  const checkIsPinned = useCallback(
    (sessionId: string) => {
      return pinnedSessionIds.includes(sessionId);
    },
    [pinnedSessionIds],
  );


  return useMemo(
    () => ({
      ...snapshot,
      pinnedSessionIds,
      pinSession: pin,
      unpinSession: unpin,
      isSessionPinned: checkIsPinned,
      sendMessage,
      startNew,
      openSession,
      setTemporary,
      deleteSession,
      dislikeMessage,
    }),
    [
      checkIsPinned,
      deleteSession,
      dislikeMessage,
      openSession,
      pin,
      pinnedSessionIds,
      sendMessage,
      setTemporary,
      snapshot,
      startNew,
      unpin,
    ],
  );
}
