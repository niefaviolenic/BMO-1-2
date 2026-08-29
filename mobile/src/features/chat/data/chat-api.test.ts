/* eslint-disable import/no-unresolved */
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import { searchChatMessages, sendChatMessage } from './chat-api';
vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    message: {
      id: 'mock-user-msg-id',
      sender: 'user',
      text: 'Hello from mobile',
      sourceDeviceId: null,
      createdAt: '2026-08-27T00:00:00.000Z',
    },
    assistantMessage: {
      id: 'mock-assistant-msg-id',
      sender: 'assistant',
      text: 'Hello there!',
      createdAt: '2026-08-27T00:00:01.000Z',
    },
  }),
}));

describe('chat-api', () => {
  it('sends mobile chat message without deviceId in request body', async () => {
    const sessionId = 'test-session-id';
    const text = 'Hello from mobile app';

    await sendChatMessage(sessionId, text);

    expect(apiRequest).toHaveBeenCalledWith(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: {
        idempotencyKey: expect.any(String),
        text,
        speakOnDevice: false,
      },
    });

    const callPayload = vi.mocked(apiRequest).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(callPayload).not.toHaveProperty('deviceId');
  });

  it('calls /chat/search with query and limit and maps results', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      results: [
        {
          id: 'session-123',
          title: 'Kontak Budi',
          snippet: '...kontak Budi Santoso...',
          lastMessageAt: null,
          updatedAt: '2026-08-28T00:00:00.000Z',
        },
      ],
    });

    const results = await searchChatMessages('Budi');
    expect(apiRequest).toHaveBeenCalledWith('/chat/search?q=Budi&limit=50');
    expect(results).toEqual([
      {
        id: 'session-123',
        title: 'Kontak Budi',
        snippet: '...kontak Budi Santoso...',
      },
    ]);
  });
});
