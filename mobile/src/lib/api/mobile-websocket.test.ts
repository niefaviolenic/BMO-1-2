/* eslint-disable import/no-unresolved */
// @ts-ignore
import { describe, expect, it } from 'vitest';

import { normalizeMobileInboundEvent } from './mobile-websocket';

describe('normalizeMobileInboundEvent', () => {
  const sessionId = '00000000-0000-4000-8000-000000000010';
  const messageId = '00000000-0000-4000-8000-000000000020';
  const deviceId = '00000000-0000-4000-8000-000000000030';
  const createdAt = '2026-08-27T02:00:00.000Z';

  it('normalizes assistant chat_message events', () => {
    const event = {
      event: 'chat_message',
      sessionId,
      message: {
        id: messageId,
        sender: 'assistant',
        text: 'Hai! Joy di sini.',
        createdAt,
      },
    };

    const normalized = normalizeMobileInboundEvent(event);
    expect(normalized).toEqual({
      event: 'chat_message',
      sessionId,
      message: {
        id: messageId,
        sender: 'assistant',
        text: 'Hai! Joy di sini.',
        sourceDeviceId: null,
        createdAt,
      },
    });
  });

  it('normalizes user chat_message events with robot sourceDeviceId', () => {
    const event = {
      event: 'chat_message',
      sessionId,
      message: {
        id: messageId,
        sender: 'user',
        text: 'Hai Joy apa kabar?',
        sourceDeviceId: deviceId,
        createdAt,
      },
    };

    const normalized = normalizeMobileInboundEvent(event);
    expect(normalized).toEqual({
      event: 'chat_message',
      sessionId,
      message: {
        id: messageId,
        sender: 'user',
        text: 'Hai Joy apa kabar?',
        sourceDeviceId: deviceId,
        createdAt,
      },
    });
  });

  it('normalizes chat_thinking events', () => {
    const event = {
      event: 'chat_thinking',
      sessionId,
      messageId,
    };

    const normalized = normalizeMobileInboundEvent(event);
    expect(normalized).toEqual({
      event: 'chat_thinking',
      sessionId,
      messageId,
    });
  });

  it('normalizes chat_title_updated events', () => {
    const event = {
      event: 'chat_title_updated',
      sessionId,
      title: 'Topik Baru',
    };

    const normalized = normalizeMobileInboundEvent(event);
    expect(normalized).toEqual({
      event: 'chat_title_updated',
      sessionId,
      title: 'Topik Baru',
    });
  });
});
