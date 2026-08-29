// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  isApiError: vi.fn().mockReturnValue(false),
  subscribeMobileWebSocket: vi.fn().mockReturnValue(() => {}),
  isIntegrationStatusEvent: vi.fn().mockReturnValue(false),
  isWhatsAppNotificationEvent: vi.fn().mockReturnValue(false),
}));

import {
  isPluginInstalled,
  installPlugin,
  uninstallPlugin,
} from './use-installed-plugins';
import {
  getWhatsAppSessionState,
} from './whatsapp-session-store';
import {
  getSpotifySessionState,
} from './spotify-session-store';

describe('use-installed-plugins data logic', () => {
  it('detects whatsapp is installed when whatsapp session status is CONNECTED', () => {
    const waState = getWhatsAppSessionState();
    waState.connection = {
      status: 'CONNECTED',
      phoneNumber: '+628123456789',
      connectedAt: '2026-08-29T10:00:00Z',
    };

    expect(isPluginInstalled('whatsapp')).toBe(true);

    waState.connection = {
      status: 'DISCONNECTED',
      phoneNumber: null,
      connectedAt: null,
    };
    expect(isPluginInstalled('whatsapp')).toBe(false);
  });

  it('detects spotify is installed when spotify session status is CONNECTED', () => {
    const spState = getSpotifySessionState();
    spState.connection = {
      status: 'CONNECTED',
      displayName: 'Joy User',
      connectedAt: '2026-08-29T10:00:00Z',
    };

    expect(isPluginInstalled('spotify')).toBe(true);

    spState.connection = {
      status: 'DISCONNECTED',
      displayName: null,
      connectedAt: null,
    };
    expect(isPluginInstalled('spotify')).toBe(false);
  });

  it('handles local plugins installation and uninstallation', () => {
    installPlugin('custom-plugin', 'Custom Plugin');
    expect(isPluginInstalled('custom-plugin')).toBe(true);

    uninstallPlugin('custom-plugin');
    expect(isPluginInstalled('custom-plugin')).toBe(false);
  });
});
