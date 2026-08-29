import type { MemorySettings } from '@/features/settings/domain/memory/types';

export const EMPTY_MEMORY_SETTINGS: MemorySettings = {
  enableMemory: true,
  nickname: '',
  occupation: '',
  moreAboutYou: '',
};

export const MEMORY_FIELD_PLACEHOLDERS = {
  occupation: 'Engineer, student, etc.',
  moreAboutYou: 'Interests, values, or preferences to keep in mind',
} as const;
