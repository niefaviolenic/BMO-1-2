export type ProfilePatchInput = {
  displayName?: string | null;
  username?: string;
};

export type AvatarUploadInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export type UserSettings = {
  language: string;
  responseLength: 'brief' | 'standard' | 'detailed';
  automaticMemoryCandidates: boolean;
  timezone: string;
};

export type UserSettingsPatchInput = {
  language?: string;
  responseLength?: UserSettings['responseLength'];
  automaticMemoryCandidates?: boolean;
};

export type PersonalizationSettings = {
  baseStyleTone: string;
  warmth: string;
  enthusiasm: string;
  headerAndLists: string;
  emoji: string;
  fastAnswers: boolean;
  customInstructions: string;
};

export type PersonalizationPatchInput = Partial<PersonalizationSettings>;
