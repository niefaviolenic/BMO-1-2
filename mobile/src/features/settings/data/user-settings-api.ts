import { apiRequest } from '@/lib/api';

import type { UserSettings, UserSettingsPatchInput } from '../domain/account/types';

type UserSettingsResponse = {
  settings: UserSettings;
};

export async function fetchUserSettings(): Promise<UserSettings> {
  const payload = await apiRequest<UserSettingsResponse>('/settings/user');
  return payload.settings;
}

export async function updateUserSettings(input: UserSettingsPatchInput): Promise<UserSettings> {
  const payload = await apiRequest<UserSettingsResponse>('/settings/user', {
    method: 'PATCH',
    body: input,
  });
  return payload.settings;
}
