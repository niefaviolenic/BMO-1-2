import { apiRequest } from '@/lib/api';

import type {
  AcceptedChatMessage,
  ChatMessageListResponse,
  ChatSession,
  ChatSessionListResponse,
} from '../domain/chat-session';
import type { ChatThread } from '../domain/chat-thread';

import { createUuid } from './uuid';

type SessionResponse = {
  session: ChatSession;
};

export async function listChatSessions(): Promise<ChatSession[]> {
  const payload = await apiRequest<ChatSessionListResponse>('/chat/sessions');
  return payload.sessions;
}

export async function createChatSession(temporary: boolean): Promise<ChatSession> {
  const payload = await apiRequest<SessionResponse>('/chat/sessions', {
    method: 'POST',
    body: { temporary },
  });
  return payload.session;
}

export async function listChatMessages(
  sessionId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<ChatMessageListResponse> {
  const params = new URLSearchParams();
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  if (options.limit != null) {
    params.set('limit', String(options.limit));
  }
  const query = params.toString();
  const path = query
    ? `/chat/sessions/${sessionId}/messages?${query}`
    : `/chat/sessions/${sessionId}/messages`;
  return apiRequest<ChatMessageListResponse>(path);
}

export async function sendChatMessage(
  sessionId: string,
  text: string,
): Promise<AcceptedChatMessage> {
  return apiRequest<AcceptedChatMessage>(`/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: {
      idempotencyKey: createUuid(),
      text,
      speakOnDevice: false,
    },
  });
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiRequest<void>(`/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export type ChatFeedbackRating = 'positive' | 'negative';

export type ChatFeedback = {
  messageId: string;
  rating: ChatFeedbackRating;
  reason: string | null;
  updatedAt: string;
};

type ChatFeedbackResponse = {
  feedback: ChatFeedback;
};

export async function submitChatFeedback(
  messageId: string,
  rating: ChatFeedbackRating,
  reason?: string,
): Promise<ChatFeedback> {
  const payload = await apiRequest<ChatFeedbackResponse>(
    `/chat/messages/${messageId}/feedback`,
    {
      method: 'POST',
      body: {
        rating,
        ...(reason === undefined ? {} : { reason }),
      },
    },
  );
  return payload.feedback;
}

export type ChatSearchResult = {
  id: string;
  title: string;
  snippet: string;
  lastMessageAt: string | null;
  updatedAt: string;
};

export type ChatSearchResponse = {
  results: ChatSearchResult[];
};

export async function searchChatMessages(
  query: string,
  limit = 50,
): Promise<ChatThread[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
  });
  const payload = await apiRequest<ChatSearchResponse>(`/chat/search?${params.toString()}`);
  return payload.results.map((item) => ({
    id: item.id,
    title: item.title,
    snippet: item.snippet,
  }));
}
