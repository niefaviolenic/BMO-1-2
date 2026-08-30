import { useSyncExternalStore } from 'react';

import { Colors } from '@/constants/theme';
import {
  getAccentPreference,
  subscribeAccent,
} from '@/features/settings/data/accent-store';
import {
  getAccentOption,
  type AccentColorMode,
} from '@/features/settings/domain/theme/types';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePalette = typeof Colors.light;

export function useTheme(): ThemePalette {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';
  const accent = useSyncExternalStore(
    subscribeAccent,
    getAccentPreference,
    () => 'default' as AccentColorMode,
  );

  const option = getAccentOption(accent);
  const basePalette = Colors?.[theme] ?? (Colors?.light ?? {});
  const accentDot = theme === 'dark' ? option.darkDot : option.lightDot;
  const accentPrimary =
    option.id === 'default'
      ? (basePalette?.accentPrimary ?? (theme === 'dark' ? '#0A84FF' : '#007AFF'))
      : theme === 'dark'
        ? option.darkPrimary
        : option.lightPrimary;
  const linkPrimary = accentPrimary;

  return {
    ...basePalette,
    accentDot,
    linkPrimary,
    accentPrimary,
  };
}

