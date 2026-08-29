/* eslint-disable import/no-unresolved */
// @ts-ignore
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppConnection, WhatsAppQr } from '../domain/whatsapp';
import * as whatsappApi from './whatsapp-api';
import {
  getWhatsAppSessionState,
  startWhatsAppConnect,
  stopWhatsAppConnectPolling,
  disconnectWhatsAppIntegration,
  refreshWhatsAppRules,
} from './whatsapp-session-store';

vi.mock('@/lib/api', () => ({
  isApiError: vi.fn().mockReturnValue(false),
  subscribeMobileWebSocket: vi.fn().mockReturnValue(() => {}),
  isIntegrationStatusEvent: vi.fn().mockReturnValue(false),
  isWhatsAppNotificationEvent: vi.fn().mockReturnValue(false),
}));

vi.mock('./plugin-catalog-store', () => ({
  markCatalogPluginDisconnected: vi.fn(),
  refreshPluginCatalog: vi.fn().mockResolvedValue([]),
  setCatalogMutating: vi.fn(),
}));

describe('WhatsAppSessionStore (State 1 Only Fresh QR Flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopWhatsAppConnectPolling();
  });

  afterEach(() => {
    stopWhatsAppConnectPolling();
  });

  it('starts connect, receives fresh State 1 QR, and initializes polling', async () => {
    const mockConnection: WhatsAppConnection = {
      provider: 'whatsapp',
      status: 'DISCONNECTED',
      connectedAt: null,
      scopes: [],
    };
    const mockQr: WhatsAppQr = {
      qr: '2@fresh-qr-payload',
      expiresAt: new Date(Date.now() + 25_000).toISOString(),
      status: 'DISCONNECTED',
    };

    vi.spyOn(whatsappApi, 'connectWhatsApp').mockResolvedValue({
      connection: mockConnection,
      pairing: null as unknown as WhatsAppPairing,
    });
    vi.spyOn(whatsappApi, 'fetchWhatsAppStatus').mockResolvedValue(mockConnection);
    vi.spyOn(whatsappApi, 'fetchWhatsAppQr').mockResolvedValue(mockQr);

    await startWhatsAppConnect();

    const state = getWhatsAppSessionState();
    expect(state.qr?.qr).toBe('2@fresh-qr-payload');
    expect(state.connection?.status).toBe('DISCONNECTED');
    expect(state.isConnecting).toBe(false);
  });

  it('preserves active fresh QR during polling without re-fetching QR', async () => {
    const mockConnection: WhatsAppConnection = {
      provider: 'whatsapp',
      status: 'DISCONNECTED',
      connectedAt: null,
      scopes: [],
    };
    const mockQr: WhatsAppQr = {
      qr: '2@fresh-qr-payload-active',
      expiresAt: new Date(Date.now() + 20_000).toISOString(),
      status: 'DISCONNECTED',
    };

    vi.spyOn(whatsappApi, 'connectWhatsApp').mockResolvedValue({
      connection: mockConnection,
      pairing: null as unknown as WhatsAppPairing,
    });
    const fetchStatusSpy = vi.spyOn(whatsappApi, 'fetchWhatsAppStatus').mockResolvedValue(mockConnection);
    const fetchQrSpy = vi.spyOn(whatsappApi, 'fetchWhatsAppQr').mockResolvedValue(mockQr);

    await startWhatsAppConnect();
    expect(fetchQrSpy).toHaveBeenCalledTimes(1);

    // If fetchWhatsAppStatus is polled again while QR is active, fetchWhatsAppQr is NOT called again
    fetchStatusSpy.mockClear();
    fetchQrSpy.mockClear();

    // Verify store holds the active fresh QR
    const state = getWhatsAppSessionState();
    expect(state.qr?.qr).toBe('2@fresh-qr-payload-active');
  });

  it('stops polling and resets state on disconnect', async () => {
    vi.spyOn(whatsappApi, 'disconnectWhatsApp').mockResolvedValue(undefined);

    await disconnectWhatsAppIntegration();

    const state = getWhatsAppSessionState();
    expect(state.connection?.status).toBe('DISCONNECTED');
    expect(state.qr).toBeNull();
  });
  it('calls disconnectWhatsApp to clear stale socket when forceReset is true', async () => {
    const disconnectSpy = vi.spyOn(whatsappApi, 'disconnectWhatsApp').mockResolvedValue(undefined);
    vi.spyOn(whatsappApi, 'connectWhatsApp').mockResolvedValue({
      connection: {
        provider: 'whatsapp',
        status: 'DISCONNECTED',
        connectedAt: null,
        scopes: [],
      },
      pairing: null as unknown as WhatsAppPairing,
    });
    vi.spyOn(whatsappApi, 'fetchWhatsAppStatus').mockResolvedValue({
      provider: 'whatsapp',
      status: 'DISCONNECTED',
      connectedAt: null,
      scopes: [],
    });
    vi.spyOn(whatsappApi, 'fetchWhatsAppQr').mockResolvedValue({
      qr: '2@new-fresh-qr',
      expiresAt: new Date(Date.now() + 25_000).toISOString(),
      status: 'DISCONNECTED',
    });

    await startWhatsAppConnect(undefined, { forceReset: true });

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    const state = getWhatsAppSessionState();
    expect(state.qr?.qr).toBe('2@new-fresh-qr');
  });

  it('refreshes rules, conversations, and connection status in refreshWhatsAppRules', async () => {
    vi.spyOn(whatsappApi, 'fetchWhatsAppRules').mockResolvedValue([]);
    vi.spyOn(whatsappApi, 'fetchWhatsAppConversations').mockResolvedValue([]);
    vi.spyOn(whatsappApi, 'fetchWhatsAppStatus').mockResolvedValue({
      provider: 'whatsapp',
      status: 'CONNECTED',
      connectedAt: '2026-08-29T00:00:00.000Z',
      scopes: [],
      phoneNumber: '+628993000101',
      accountName: 'Rangga Biner',
    });

    await refreshWhatsAppRules();

    const state = getWhatsAppSessionState();
    expect(state.connection?.status).toBe('CONNECTED');
    expect(state.connection?.phoneNumber).toBe('+628993000101');
    expect(state.connection?.accountName).toBe('Rangga Biner');
  });
});
