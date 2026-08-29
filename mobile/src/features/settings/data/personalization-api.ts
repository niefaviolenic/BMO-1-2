import { apiRequest } from '@/lib/api';

import type {
  PersonalizationPatchInput,
  PersonalizationSettings,
} from '../domain/account/types';

export async function fetchPersonalization(): Promise<PersonalizationSettings> {
  return apiRequest<PersonalizationSettings>('/settings/personalization');
}

export async function updatePersonalization(
  input: PersonalizationPatchInput,
): Promise<PersonalizationSettings> {
  return apiRequest<PersonalizationSettings>('/settings/personalization', {
    method: 'PATCH',
    body: input,
  });
}
