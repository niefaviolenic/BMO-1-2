import { apiRequest } from '@/lib/api';

import type { IntegrationStatus } from '../domain/plugin';
import {
  DEFAULT_WHATSAPP_QR_TTL_SECONDS,
  type WhatsAppConnection,
  type WhatsAppConversation,
  type WhatsAppConversationType,
  type WhatsAppPairing,
  type WhatsAppQr,
  type WhatsAppRule,
  type WhatsAppRulePatch,
  type WhatsAppRuleScope,
} from '../domain/whatsapp';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asStatus(value: unknown): IntegrationStatus {
  if (
    value === 'CONNECTED' ||
    value === 'DISCONNECTED' ||
    value === 'PENDING' ||
    value === 'ERROR' ||
    value === 'RECONNECT_REQUIRED'
  ) {
    return value;
  }
  return 'DISCONNECTED';
}

function asConnection(value: unknown): WhatsAppConnection {
  const record = isRecord(value) && isRecord(value.connection) ? value.connection : value;
  if (!isRecord(record)) {
    return {
      provider: 'whatsapp',
      status: 'DISCONNECTED',
      connectedAt: null,
      scopes: [],
    };
  }

  return {
    provider: 'whatsapp',
    status: asStatus(record.status),
    connectedAt: typeof record.connectedAt === 'string' ? record.connectedAt : null,
    scopes: Array.isArray(record.scopes)
      ? record.scopes.filter((item): item is string => typeof item === 'string')
      : [],
    phoneNumber: typeof record.phoneNumber === 'string' ? record.phoneNumber : null,
    accountName: typeof record.accountName === 'string' ? record.accountName : null,
  };
}

function asPairing(value: unknown): WhatsAppPairing {
  if (!isRecord(value)) {
    return { code: null, expiresAt: null, status: 'DISCONNECTED' };
  }

  const code = typeof value.code === 'string' ? value.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  return {
    code: code.length === 8 ? code : null,
    expiresAt:
      typeof value.expiresAt === 'string'
        ? value.expiresAt
        : typeof value.expiresAt === 'string'
          ? value.expiresAt
          : null,
    status: typeof value.status === 'string' ? value.status : 'DISCONNECTED',
  };
}

function asQr(value: unknown): WhatsAppQr {
  if (!isRecord(value)) {
    return { qr: null, expiresAt: null, status: 'DISCONNECTED' };
  }

  const qr = typeof value.qr === 'string' && value.qr.length > 0 ? value.qr : null;
  let expiresAt = typeof value.expiresAt === 'string' ? value.expiresAt : null;
  if (qr && !expiresAt) {
    expiresAt = new Date(Date.now() + DEFAULT_WHATSAPP_QR_TTL_SECONDS * 1000).toISOString();
  }

  return {
    qr,
    expiresAt,
    status: typeof value.status === 'string' ? value.status : 'DISCONNECTED',
  };
}

function asRuleScope(value: unknown): WhatsAppRuleScope | null {
  if (value === 'ALL' || value === 'CONTACT' || value === 'GROUP') {
    return value;
  }
  return null;
}

function asRule(value: unknown): WhatsAppRule | null {
  if (!isRecord(value)) {
    return null;
  }
  const scope = asRuleScope(value.scope);
  if (!scope) {
    return null;
  }

  return {
    id: typeof value.id === 'string' ? value.id : null,
    scope,
    conversationId: typeof value.conversationId === 'string' ? value.conversationId : null,
    enabled: value.enabled !== false,
    speakOnDevice: value.speakOnDevice === true,
  };
}

function asConversationType(value: unknown): WhatsAppConversationType {
  return value === 'GROUP' ? 'GROUP' : 'DM';
}

function asConversation(value: unknown): WhatsAppConversation | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    id: value.id,
    displayName: typeof value.displayName === 'string' ? value.displayName : 'WhatsApp contact',
    type: asConversationType(value.type),
    notificationEnabled: value.notificationEnabled === true,
    lastActivityAt: typeof value.lastActivityAt === 'string' ? value.lastActivityAt : null,
  };
}

export type ConnectWhatsAppResult = {
  connection: WhatsAppConnection;
  blocked: boolean;
  pairing: WhatsAppPairing;
};

export async function connectWhatsApp(phoneNumber?: string): Promise<ConnectWhatsAppResult> {
  const payload = await apiRequest<{ connection?: unknown; blocked?: unknown; pairing?: unknown }>(
    '/integrations/whatsapp/connect',
    {
      method: 'POST',
      body: phoneNumber ? { phoneNumber } : {},
    },
  );
  return {
    connection: asConnection(payload),
    blocked: payload.blocked === true || payload.blocked === true,
    pairing: asPairing(isRecord(payload) ? payload.pairing : null),
  };
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppConnection> {
  const payload = await apiRequest<unknown>('/integrations/whatsapp/status');
  return asConnection(payload);
}

export async function fetchWhatsAppPairing(): Promise<WhatsAppPairing> {
  return asPairing(await apiRequest<unknown>('/integrations/whatsapp/pairing'));
}

export async function fetchWhatsAppQr(): Promise<WhatsAppQr> {
  return asQr(await apiRequest<unknown>('/integrations/whatsapp/qr'));
}

export async function dismissWhatsAppQr(): Promise<void> {
  await apiRequest<void>('/integrations/whatsapp/dismiss-qr', {
    method: 'POST',
    body: {},
  });
}

export async function confirmWhatsAppScanned(): Promise<WhatsAppConnection> {
  const payload = await apiRequest<unknown>('/integrations/whatsapp/confirm-scanned', {
    method: 'POST',
    body: {},
  });
  return asConnection(payload);
}

export async function disconnectWhatsApp(): Promise<void> {
  await apiRequest<void>('/integrations/whatsapp/disconnect', {
    method: 'POST',
    body: {},
  });
}

export async function fetchWhatsAppRules(): Promise<WhatsAppRule[]> {
  const payload = await apiRequest<{ rules?: unknown[] }>(
    '/integrations/whatsapp/notification-rules',
  );
  return (payload.rules ?? []).map(asRule).filter((item): item is WhatsAppRule => item != null);
}

export async function updateWhatsAppRules(rules: WhatsAppRulePatch[]): Promise<WhatsAppRule[]> {
  const payload = await apiRequest<{ rules?: unknown[] }>(
    '/integrations/whatsapp/notification-rules',
    {
      method: 'PATCH',
      body: { rules },
    },
  );
  return (payload.rules ?? []).map(asRule).filter((item): item is WhatsAppRule => item != null);
}

export async function fetchWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const payload = await apiRequest<{ conversations?: unknown[] }>(
    '/integrations/whatsapp/conversations?limit=100',
  );
  return (payload.conversations ?? [])
    .map(asConversation)
    .filter((item): item is WhatsAppConversation => item != null);
}

export async function resolveWhatsAppConversation(
  phoneNumber: string,
  displayName?: string,
): Promise<WhatsAppConversation> {
  const payload = await apiRequest<unknown>('/integrations/whatsapp/conversations/resolve', {
    method: 'POST',
    body: {
      phoneNumber,
      ...(displayName ? { displayName } : {}),
    },
  });
  const conversation = asConversation(payload);
  if (!conversation) {
    throw new Error('Unable to add that WhatsApp contact.');
  }
  return conversation;
}
