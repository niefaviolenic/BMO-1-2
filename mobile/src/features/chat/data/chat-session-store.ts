import {
  normalizeMobileInboundEvent,
  subscribeMobileWebSocket,
  type MobileInboundEvent,
} from '@/lib/api';

import type {
  ChatBubble,
  ChatSession,
  ChatSessionMessage,
} from '../domain/chat-session';
import type { ChatThread } from '../domain/chat-thread';

import {
  createChatSession,
  deleteChatSession as deleteChatSessionRequest,
  listChatMessages,
  listChatSessions,
  sendChatMessage,
  submitChatFeedback,
  type ChatFeedbackRating,
} from './chat-api';
import { cleanupDeletedSession } from './pinned-chat-store';

type Listener = () => void;

const MESSAGE_SYNC_DELAYS_MS = [800, 2000, 4000] as const;

export type ChatSessionState = {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatBubble[];
  isThinking: boolean;
  isTemporary: boolean;
  isSending: boolean;
  feedbackByMessageId: Record<string, ChatFeedbackRating>;
};

const listeners = new Set<Listener>();

let state: ChatSessionState = {
  sessions: [],
  activeSessionId: null,
  messages: [],
  isThinking: false,
  isTemporary: false,
  isSending: false,
  feedbackByMessageId: {},
};

let syncGeneration = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<ChatSessionState>): void {
  state = { ...state, ...patch };
  emit();
}

function toUiMessage(message: ChatSessionMessage): ChatBubble | null {
  if (message.sender === 'system') {
    return null;
  }

  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    sourceDeviceId: message.sourceDeviceId ?? null,
  };
}

function upsertMessage(messages: ChatBubble[], next: ChatBubble): ChatBubble[] {
  if (messages.some((message) => message.id === next.id)) {
    return messages;
  }
  return [...messages, next];
}

function lastSender(messages: ChatBubble[]): ChatBubble['sender'] | undefined {
  return messages[messages.length - 1]?.sender;
}

function clearMessageSync(): void {
  syncGeneration += 1;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

function scheduleMessageSync(sessionId: string, attempt = 0): void {
  if (attempt >= MESSAGE_SYNC_DELAYS_MS.length) {
    return;
  }

  const generation = syncGeneration;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncActiveMessages(sessionId, generation, attempt);
  }, MESSAGE_SYNC_DELAYS_MS[attempt]);
}

async function syncActiveMessages(
  sessionId: string,
  generation: number,
  attempt: number,
): Promise<void> {
  if (generation !== syncGeneration || state.activeSessionId !== sessionId) {
    return;
  }

  if (lastSender(state.messages) === 'assistant') {
    if (state.isThinking) {
      setState({ isThinking: false });
    }
    return;
  }

  try {
    const payload = await listChatMessages(sessionId, { limit: 50 });
    if (generation !== syncGeneration || state.activeSessionId !== sessionId) {
      return;
    }

    const messages = payload.messages
      .map(toUiMessage)
      .filter((message): message is ChatBubble => message != null);
    const waitingForAssistant = lastSender(messages) !== 'assistant';

    setState({
      messages,
      isThinking: waitingForAssistant,
    });

    if (waitingForAssistant && state.isThinking) {
      scheduleMessageSync(sessionId, attempt + 1);
    }
  } catch {
    if (generation === syncGeneration && state.activeSessionId === sessionId && state.isThinking) {
      scheduleMessageSync(sessionId, attempt + 1);
    }
  }
}

export function getChatSessionState(): ChatSessionState {
  return state;
}

export function subscribeChatSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function sessionToThread(session: ChatSession): ChatThread {
  return {
    id: session.id,
    title: session.title?.trim() || 'New chat',
    snippet: session.snippet?.trim() || '',
  };
}

export async function refreshChatSessions(): Promise<void> {
  const sessions = await listChatSessions();
  setState({ sessions });
}

export async function startNewChat(temporary = false): Promise<void> {
  clearMessageSync();
  setState({
    activeSessionId: null,
    messages: [],
    isThinking: false,
    isTemporary: temporary,
    isSending: false,
  });
}

export function setTemporaryChat(isTemporary: boolean): void {
  if (state.messages.length > 0) {
    clearMessageSync();
    setState({
      activeSessionId: null,
      messages: [],
      isThinking: false,
      isTemporary,
      isSending: false,
    });
    return;
  }

  setState({ isTemporary });
}

export async function openChatSession(sessionId: string): Promise<void> {
  clearMessageSync();
  const payload = await listChatMessages(sessionId, { limit: 50 });
  const messages = payload.messages
    .map(toUiMessage)
    .filter((message): message is ChatBubble => message != null);
  const session = state.sessions.find((item) => item.id === sessionId);

  setState({
    activeSessionId: sessionId,
    messages,
    isThinking: false,
    isTemporary: session?.temporary ?? false,
    isSending: false,
  });
}

export function generateOptimisticTitle(text: string): string {
  const firstLine = text.split('\n').find((line) => line.trim().length > 0) ?? '';
  const collapsed = firstLine.trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return 'New chat';
  }
  if (collapsed.length <= 40) {
    return collapsed;
  }
  return `${collapsed.slice(0, 40).trimEnd()}...`;
}

export async function sendActiveChatMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || state.isSending || state.isThinking) {
    return;
  }

  setState({ isSending: true });
  clearMessageSync();

  try {
    let sessionId = state.activeSessionId;
    if (!sessionId) {
      const session = await createChatSession(state.isTemporary);
      sessionId = session.id;
      setState({
        activeSessionId: session.id,
        sessions: state.isTemporary
          ? state.sessions
          : [session, ...state.sessions.filter((item) => item.id !== session.id)],
      });
    }

    const currentSession = state.sessions.find((item) => item.id === sessionId);
    const isInitialTitle =
      !currentSession?.title ||
      currentSession.title.trim() === 'New chat' ||
      state.messages.length === 0;

    if (isInitialTitle && !state.isTemporary) {
      const optimisticTitle = generateOptimisticTitle(trimmed);
      setState({
        sessions: state.sessions.map((item) =>
          item.id === sessionId ? { ...item, title: optimisticTitle } : item,
        ),
      });
    }

    const baselineCount = state.messages.length;
    const accepted = await sendChatMessage(sessionId, trimmed);
    const userMessage = toUiMessage(accepted.userMessage);
    const prefix = state.messages.slice(0, baselineCount);
    const extras = state.messages.slice(baselineCount);
    const withUser = userMessage ? upsertMessage(prefix, userMessage) : prefix;
    const nextMessages = extras.reduce(
      (messages, extra) => upsertMessage(messages, extra),
      withUser,
    );
    const assistantAlreadyPresent = lastSender(nextMessages) === 'assistant';
    const isThinking =
      accepted.assistant.status === 'processing' && !assistantAlreadyPresent;

    setState({
      messages: nextMessages,
      isThinking,
      isSending: false,
    });

    if (isThinking) {
      scheduleMessageSync(sessionId);
    }

    void refreshChatSessions().catch(() => undefined);
  } catch (error) {
    clearMessageSync();
    setState({ isSending: false, isThinking: false });
    throw error;
  }
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await deleteChatSessionRequest(sessionId);
  void cleanupDeletedSession(sessionId);
  const nextSessions = state.sessions.filter((session) => session.id !== sessionId);
  const nextFeedback = { ...state.feedbackByMessageId };

  if (state.activeSessionId === sessionId) {
    for (const message of state.messages) {
      delete nextFeedback[message.id];
    }
    clearMessageSync();
    setState({
      sessions: nextSessions,
      activeSessionId: null,
      messages: [],
      isThinking: false,
      isTemporary: false,
      isSending: false,
      feedbackByMessageId: nextFeedback,
    });
    return;
  }

  setState({
    sessions: nextSessions,
    feedbackByMessageId: nextFeedback,
  });
}

export async function submitNegativeFeedback(messageId: string): Promise<void> {
  const previous = state.feedbackByMessageId[messageId];
  setState({
    feedbackByMessageId: {
      ...state.feedbackByMessageId,
      [messageId]: 'negative',
    },
  });

  try {
    await submitChatFeedback(messageId, 'negative');
  } catch (error) {
    const nextFeedback = { ...state.feedbackByMessageId };
    if (previous === undefined) {
      delete nextFeedback[messageId];
    } else {
      nextFeedback[messageId] = previous;
    }
    setState({ feedbackByMessageId: nextFeedback });
    throw error;
  }
}

export function resetChatSessionState(): void {
  clearMessageSync();
  setState({
    sessions: [],
    activeSessionId: null,
    messages: [],
    isThinking: false,
    isTemporary: false,
    isSending: false,
    feedbackByMessageId: {},
  });
}

function applyRealtimeMessage(sessionId: string, message: ChatBubble): void {
  if (state.activeSessionId === null && state.messages.length === 0 && !state.isTemporary) {
    setState({
      activeSessionId: sessionId,
      messages: [message],
      isThinking: message.sender === 'user',
    });
    return;
  }

  if (sessionId !== state.activeSessionId) {
    return;
  }

  if (message.sender === 'user') {
    setState({
      messages: upsertMessage(state.messages, message),
      isThinking: true,
    });
    return;
  }

  clearMessageSync();
  setState({
    messages: upsertMessage(state.messages, message),
    isThinking: false,
  });
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  const normalized = normalizeMobileInboundEvent(event);
  if (!normalized) {
    return;
  }

  if (normalized.event === 'chat_thinking') {
    if (state.activeSessionId === null && state.messages.length === 0 && !state.isTemporary) {
      setState({ activeSessionId: normalized.sessionId, isThinking: true });
      return;
    }

    if (normalized.sessionId !== state.activeSessionId) {
      return;
    }

    if (lastSender(state.messages) === 'assistant') {
      return;
    }

    setState({ isThinking: true });
    return;
  }
  if (normalized.event === 'chat_title_updated') {
    setState({
      sessions: state.sessions.map((s) =>
        s.id === normalized.sessionId ? { ...s, title: normalized.title } : s
      ),
    });
    return;
  }

  void refreshChatSessions().catch(() => undefined);
  applyRealtimeMessage(normalized.sessionId, {
    id: normalized.message.id,
    sender: normalized.message.sender,
    text: normalized.message.text,
    sourceDeviceId: normalized.message.sourceDeviceId,
  });
}

subscribeMobileWebSocket(handleRealtimeEvent);
