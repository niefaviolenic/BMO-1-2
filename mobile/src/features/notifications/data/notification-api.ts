import { apiRequest } from '@/lib/api';

import type { PushTokenRecord } from '../domain/notification';

type PushTokenResponse = {
  ok: boolean;
  token?: { id: string; token: string };
};

type ListPushTokensResponse = {
  ok: boolean;
  tokens: PushTokenRecord[];
};

type DeletePushTokenResponse = {
  ok: boolean;
  success: boolean;
};

export async function registerPushTokenApi(
  token: string,
  platform: 'android' | 'ios' | 'web' | 'expo' = 'expo',
  deviceId?: string | null,
): Promise<{ id?: string; token: string }> {
  const payload = await apiRequest<PushTokenResponse>('/settings/push-tokens', {
    method: 'POST',
    body: {
      token: token.trim(),
      platform,
      deviceId: deviceId ?? null,
    },
  });
  return payload.token ?? { token };
}

export async function unregisterPushTokenApi(token: string): Promise<boolean> {
  const payload = await apiRequest<DeletePushTokenResponse>('/settings/push-tokens', {
    method: 'DELETE',
    body: { token: token.trim() },
  });
  return payload.success;
}

export async function listPushTokensApi(): Promise<PushTokenRecord[]> {
  const payload = await apiRequest<ListPushTokensResponse>('/settings/push-tokens');
  return payload.tokens ?? [];
}
