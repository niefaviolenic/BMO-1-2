export type AppearanceMode = 'system' | 'dark' | 'light';

export type AppearanceOption = {
  id: AppearanceMode;
  label: string;
};

export const APPEARANCE_OPTIONS: readonly AppearanceOption[] = [
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
] as const;

export function formatAppearanceLabel(mode: AppearanceMode): string {
  switch (mode) {
    case 'dark':
      return 'Dark';
    case 'light':
      return 'Light';
    case 'system':
    default:
      return 'System';
  }
}

export type AccentColorMode = 'default' | 'purple' | 'green' | 'orange' | 'pink';

export type AccentColorOption = {
  id: AccentColorMode;
  label: string;
  lightDot: string;
  darkDot: string;
  lightPrimary: string;
  darkPrimary: string;
};

export const ACCENT_COLOR_OPTIONS: readonly AccentColorOption[] = [
  {
    id: 'default',
    label: 'Default',
    lightDot: '#007AFF',
    darkDot: '#0A84FF',
    lightPrimary: '#007AFF',
    darkPrimary: '#0A84FF',
  },
  {
    id: 'purple',
    label: 'Purple',
    lightDot: '#8B5CF6',
    darkDot: '#A855F7',
    lightPrimary: '#8B5CF6',
    darkPrimary: '#A855F7',
  },
  {
    id: 'green',
    label: 'Green',
    lightDot: '#22C55E',
    darkDot: '#4ADE80',
    lightPrimary: '#22C55E',
    darkPrimary: '#4ADE80',
  },
  {
    id: 'orange',
    label: 'Orange',
    lightDot: '#F97316',
    darkDot: '#FB923C',
    lightPrimary: '#F97316',
    darkPrimary: '#FB923C',
  },
  {
    id: 'pink',
    label: 'Pink',
    lightDot: '#EC4899',
    darkDot: '#F472B6',
    lightPrimary: '#EC4899',
    darkPrimary: '#F472B6',
  },
] as const;

export function formatAccentColorLabel(mode: AccentColorMode): string {
  const match = ACCENT_COLOR_OPTIONS.find((opt) => opt.id === mode);
  return match ? match.label : 'Default';
}

export function getAccentOption(mode: AccentColorMode): AccentColorOption {
  return ACCENT_COLOR_OPTIONS.find((opt) => opt.id === mode) ?? ACCENT_COLOR_OPTIONS[0];
}

