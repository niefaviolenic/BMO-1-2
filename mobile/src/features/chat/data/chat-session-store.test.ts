/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MobileInboundEvent } from '@/lib/api';
// @ts-ignore
import { __dispatchWebSocketEvent } from '@/lib/api';
import {
  listChatMessages,
} from './chat-api';
import {
  getChatSessionState,
  openChatSession,
  resetChatSessionState,
  startNewChat,
} from './chat-session-store';

vi.mock('@/lib/api', () => {
  let wsCallback: ((event: MobileInboundEvent) => void) | null = null;
  return {
    normalizeMobileInboundEvent: (event: MobileInboundEvent) => {
      if (!event || typeof event !== 'object') return null;
      const rec = event as Record<string, unknown>;
      const eventName = typeof rec.event === 'string' ? rec.event : '';
      const sessionId = typeof rec.sessionId === 'string' ? rec.sessionId : '';
      if (!eventName || !sessionId) return null;
      if (eventName === 'chat_message') {
        const msg = (rec.message && typeof rec.message === 'object' ? rec.message : {}) as Record<string, unknown>;
        return {
          event: 'chat_message',
          sessionId,
          message: {
            id: typeof msg.id === 'string' ? msg.id : '',
            sender: msg.sender === 'user' ? ('user' as const) : ('assistant' as const),
            text: typeof msg.text === 'string' ? msg.text : '',
            sourceDeviceId: typeof msg.sourceDeviceId === 'string' ? msg.sourceDeviceId : null,
            createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : '',
          },
        };
      }
      if (eventName === 'chat_thinking') {
        return {
          event: 'chat_thinking',
          sessionId,
          messageId: typeof rec.messageId === 'string' ? rec.messageId : '',
        };
      }
      return null;
    },
    subscribeMobileWebSocket: (cb: (event: MobileInboundEvent) => void) => {
      wsCallback = cb;
      return () => {
        wsCallback = null;
      };
    },
    __dispatchWebSocketEvent: (event: MobileInboundEvent) => {
      wsCallback?.(event);
    },
  };
});

vi.mock('./chat-api', () => ({
  listChatSessions: vi.fn().mockResolvedValue([]),
  listChatMessages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
  createChatSession: vi.fn().mockResolvedValue({ id: 'mock-session-id', temporary: false, title: null }),
  sendChatMessage: vi.fn(),
  deleteChatSession: vi.fn(),
  submitChatFeedback: vi.fn(),
}));

vi.mock('./pinned-chat-store', () => ({
  cleanupDeletedSession: vi.fn(),
}));

describe('chat-session-store realtime events', () => {
  const sessionId = '00000000-0000-4000-8000-000000000010';
  const userMsgId = '00000000-0000-4000-8000-000000000020';
  const assistantMsgId = '00000000-0000-4000-8000-000000000030';
  const deviceId = '00000000-0000-4000-8000-000000000088';

  beforeEach(() => {
    resetChatSessionState();
  });

  it('displays user transcript in real-time when user speaks to robot', async () => {
    await openChatSession(sessionId);
    expect(getChatSessionState().activeSessionId).toBe(sessionId);
    expect(getChatSessionState().messages).toHaveLength(0);

    // 1. User voice transcribed event received
    __dispatchWebSocketEvent({
      event: 'chat_message',
      sessionId,
      message: {
        id: userMsgId,
        sender: 'user',
        text: 'Hai hai hai hai hai Hai sebenarnya lebih meledak lagi',
        sourceDeviceId: deviceId,
        createdAt: '2026-08-27T02:00:00.000Z',
      },
    });

    // Verify user bubble appears immediately and isThinking is set
    const stateAfterUser = getChatSessionState();
    expect(stateAfterUser.messages).toHaveLength(1);
    expect(stateAfterUser.messages[0]).toEqual({
      id: userMsgId,
      sender: 'user',
      text: 'Hai hai hai hai hai Hai sebenarnya lebih meledak lagi',
      sourceDeviceId: deviceId,
    });
    expect(stateAfterUser.isThinking).toBe(true);

    // 2. Assistant response event received
    __dispatchWebSocketEvent({
      event: 'chat_message',
      sessionId,
      message: {
        id: assistantMsgId,
        sender: 'assistant',
        text: 'Hai hai hai juga, Ranggabiner! Wah, energinya meledak banget-Joy ikut ikutan heboh nih!',
        createdAt: '2026-08-27T02:00:02.000Z',
      },
    });

    // Verify assistant bubble appears and isThinking is cleared
    const stateAfterAssistant = getChatSessionState();
    expect(stateAfterAssistant.messages).toHaveLength(2);
    expect(stateAfterAssistant.messages[0].sender).toBe('user');
    expect(stateAfterAssistant.messages[1].sender).toBe('assistant');
    expect(stateAfterAssistant.messages[1].text).toBe(
      'Hai hai hai juga, Ranggabiner! Wah, energinya meledak banget-Joy ikut ikutan heboh nih!'
    );
    expect(stateAfterAssistant.isThinking).toBe(false);
  });

  it('adopts session and displays user transcript when activeSessionId is null on clean chat screen', async () => {
    await startNewChat(false);
    expect(getChatSessionState().activeSessionId).toBeNull();
    expect(getChatSessionState().messages).toHaveLength(0);

    __dispatchWebSocketEvent({
      event: 'chat_message',
      sessionId,
      message: {
        id: userMsgId,
        sender: 'user',
        text: 'Halo Joy robot!',
        sourceDeviceId: deviceId,
      },
    });

    const state = getChatSessionState();
    expect(state.activeSessionId).toBe(sessionId);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].sender).toBe('user');
    expect(state.messages[0].text).toBe('Halo Joy robot!');
    expect(state.isThinking).toBe(true);
  });

  it('preserves sourceDeviceId when opening existing chat session with robot messages', async () => {
    const mockListChatMessages = vi.mocked(listChatMessages);
    mockListChatMessages.mockResolvedValueOnce({
      messages: [
        {
          id: userMsgId,
          sender: 'user',
          text: 'Halo dari robot',
          sourceDeviceId: deviceId,
          createdAt: '2026-08-27T02:00:00.000Z',
        },
        {
          id: assistantMsgId,
          sender: 'assistant',
          text: 'Halo! Aku Joy robot.',
          createdAt: '2026-08-27T02:00:02.000Z',
        },
      ],
      nextCursor: null,
    });

    await openChatSession(sessionId);

    const state = getChatSessionState();
    expect(state.activeSessionId).toBe(sessionId);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toEqual({
      id: userMsgId,
      sender: 'user',
      text: 'Halo dari robot',
      sourceDeviceId: deviceId,
    });
    expect(state.messages[1]).toEqual({
      id: assistantMsgId,
      sender: 'assistant',
      text: 'Halo! Aku Joy robot.',
      sourceDeviceId: null,
    });
  });
});
