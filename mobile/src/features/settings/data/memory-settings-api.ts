import { apiRequest } from '@/lib/api';
import { createUuid } from '@/features/chat/data/uuid';

import { updateProfile } from '@/features/settings/data/profile-api';
import type { MemorySettings } from '@/features/settings/domain/memory/types';

import {
  loadMemoryProfile,
  saveMemoryProfile,
} from './memory/memory-profile-store';

export type MemorySettingsResponse = {
  automaticMemoryCandidates: boolean;
};

export async function fetchMemorySettings(): Promise<MemorySettingsResponse> {
  return apiRequest<MemorySettingsResponse>('/settings/memory');
}

export async function updateMemorySettings(
  automaticMemoryCandidates: boolean,
): Promise<MemorySettingsResponse> {
  return apiRequest<MemorySettingsResponse>('/settings/memory', {
    method: 'PATCH',
    body: { automaticMemoryCandidates },
  });
}

export async function fetchMemoryProfileFields(
  userId: string,
  displayName: string | null,
): Promise<Pick<MemorySettings, 'nickname' | 'occupation' | 'moreAboutYou'>> {
  const local = await loadMemoryProfile(userId);
  return {
    nickname: displayName ?? '',
    occupation: local.occupation,
    moreAboutYou: local.moreAboutYou,
  };
}

export async function saveMemoryProfileFields(
  userId: string,
  fields: Pick<MemorySettings, 'nickname' | 'occupation' | 'moreAboutYou'>,
): Promise<string> {
  await saveMemoryProfile(userId, {
    occupation: fields.occupation,
    moreAboutYou: fields.moreAboutYou,
  });

  const trimmedNickname = fields.nickname.trim();
  if (trimmedNickname.length < 1) {
    return '';
  }

  const user = await updateProfile({ displayName: trimmedNickname });
  return user.displayName ?? trimmedNickname;
}

export type MemoryItemDto = {
  id: string;
  topic: string;
  category: string;
  content: string;
  importance: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type ListMemoriesResponse = {
  memories: MemoryItemDto[];
  nextCursor: string | null;
};

export async function fetchMemoriesList(): Promise<MemoryItemDto[]> {
  const payload = await apiRequest<ListMemoriesResponse>('/memories?limit=50');
  return payload.memories ?? [];
}

export async function deleteMemoryRecord(id: string): Promise<void> {
  const idempotencyKey = createUuid();
  await apiRequest<void>(`/memories/${id}`, {
    method: 'DELETE',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: { idempotencyKey },
  });
}
