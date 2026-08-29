export type ChatSession = {
  id: string;
  temporary: boolean;
  title: string | null;
  snippet?: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatSender = 'user' | 'assistant' | 'system';

export type ChatBubble = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sourceDeviceId?: string | null;
};

export type ChatSessionMessage = {
  id: string;
  sender: ChatSender;
  text: string;
  createdAt: string;
  cursor?: string;
  sourceDeviceId?: string | null;
};

export type AcceptedChatMessage = {
  userMessage: ChatSessionMessage;
  assistant: {
    status: 'processing' | 'succeeded' | 'failed' | 'cancelled';
    operationId: string;
    errorCode?: string;
  };
};

export type ChatSessionListResponse = {
  sessions: ChatSession[];
};

export type ChatMessageListResponse = {
  messages: ChatSessionMessage[];
  nextCursor: string | null;
};

