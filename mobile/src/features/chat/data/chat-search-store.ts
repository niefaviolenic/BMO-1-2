import type { ChatThread } from '@/features/chat/domain/chat-thread';

import {
  getChatSessionState,
  sessionToThread,
  subscribeChatSession,
} from './chat-session-store';

type Listener = () => void;

let lastOpenedIds: string[] = [];
let cachedLastOpenedChats: ChatThread[] = [];

const listeners = new Set<Listener>();

function emit() {
  cachedLastOpenedChats = rebuildLastOpenedChats();
  listeners.forEach((listener) => listener());
}

function allThreads(): ChatThread[] {
  return getChatSessionState().sessions.map(sessionToThread);
}

function rebuildLastOpenedChats(): ChatThread[] {
  const threads = allThreads();
  return lastOpenedIds
    .map((id) => threads.find((chat) => chat.id === id))
    .filter((chat): chat is ChatThread => chat != null);
}

export function getLastOpenedIds(): string[] {
  return lastOpenedIds;
}

export function getLastOpenedChats(): ChatThread[] {
  return cachedLastOpenedChats;
}

export function resetChatSearchStoreForTest(): void {
  lastOpenedIds = [];
  cachedLastOpenedChats = [];
  listeners.clear();
}

export function markChatOpened(chatId: string): void {
  lastOpenedIds = [chatId, ...lastOpenedIds.filter((id) => id !== chatId)];
  emit();
}

export function searchChats(query: string): ChatThread[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return allThreads().filter(
    (chat) =>
      chat.title.toLowerCase().includes(normalized) ||
      chat.snippet.toLowerCase().includes(normalized)
  );
}

export function getChatById(chatId: string): ChatThread | undefined {
  return allThreads().find((chat) => chat.id === chatId);
}

export function subscribeChatSearch(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

subscribeChatSession(() => {
  emit();
});
