import { isIntegrationConnected, type IntegrationStatus } from './plugin';

export type WhatsAppConnection = {
  provider: 'whatsapp';
  status: IntegrationStatus;
  connectedAt: string | null;
  scopes: string[];
  phoneNumber?: string | null;
  accountName?: string | null;
};
export const DEFAULT_WHATSAPP_QR_TTL_SECONDS = 25;


export type WhatsAppQr = {
  qr: string | null;
  expiresAt: string | null;
  status: IntegrationStatus | string;
};

export type WhatsAppPairing = {
  code: string | null;
  expiresAt: string | null;
  status: IntegrationStatus | string;
};

export type WhatsAppRuleScope = 'ALL' | 'CONTACT' | 'GROUP';

export type WhatsAppRule = {
  id: string | null;
  scope: WhatsAppRuleScope;
  conversationId: string | null;
  enabled: boolean;
  speakOnDevice: boolean;
};

export type WhatsAppRulePatch = {
  scope: WhatsAppRuleScope;
  conversationId?: string;
  enabled?: boolean;
  speakOnDevice?: boolean;
};

export type WhatsAppConversationType = 'DM' | 'GROUP';

export type WhatsAppConversation = {
  id: string;
  displayName: string;
  type: WhatsAppConversationType;
  notificationEnabled: boolean;
  lastActivityAt: string | null;
};

export function isWhatsAppConnected(status: string | undefined): boolean {
  return isIntegrationConnected(status);
}

export function toWhatsAppE164(nationalNumber: string, countryCallingCode = '62'): string {
  const digits = nationalNumber.replace(/\D/g, '');
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  if (national.length < 8 || national.length > 13) {
    throw new Error('Enter a valid WhatsApp number.');
  }
  return `+${countryCallingCode}${national}`;
}

export function secondsUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) {
    return null;
  }
  const deltaMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(deltaMs)) {
    return null;
  }
  return Math.max(0, Math.floor(deltaMs / 1000));
}

export function classifyQrPayload(
  qr: string | null,
): 'empty' | 'image' | 'text' {
  if (!qr || qr.trim().length === 0) {
    return 'empty';
  }
  if (qr.startsWith('data:image')) {
    return 'image';
  }
  if (/^https?:\/\//u.test(qr) && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/iu.test(qr)) {
    return 'image';
  }
  return 'text';
}


const AVATAR_COLORS = ['#E56666', '#4D99E5', '#33B280', '#9966CC', '#E5A04D'] as const;

export function conversationAvatarColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

export function formatWhatsAppDisplayNumber(
  phoneNumber: string | null | undefined,
): string {
  if (!phoneNumber) {
    return '';
  }
  const trimmed = phoneNumber.trim();
  if (trimmed.length === 0) {
    return '';
  }
  if (trimmed.includes(' ') && trimmed.includes('-')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return trimmed;
  }
  if (digits.startsWith('62')) {
    const national = digits.slice(2);
    if (national.length <= 3) {
      return `+62 ${national}`;
    }
    if (national.length <= 7) {
      return `+62 ${national.slice(0, 3)}-${national.slice(3)}`;
    }
    if (national.length <= 11) {
      return `+62 ${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`;
    }
    return `+62 ${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7, 11)}${national.slice(11)}`;
  }
  if (trimmed.startsWith('+')) {
    if (digits.length <= 4) {
      return `+${digits}`;
    }
    if (digits.length <= 7) {
      return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
    }
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 9)}${digits.length > 9 ? '-' + digits.slice(9) : ''}`;
  }
  return trimmed;
}
