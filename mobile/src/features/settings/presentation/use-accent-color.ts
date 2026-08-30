import { useSyncExternalStore } from 'react';

import {
  getAccentPreference,
  setAccentPreference,
  subscribeAccent,
} from '../data/accent-store';
import {
  formatAccentColorLabel,
  getAccentOption,
  type AccentColorMode,
} from '../domain/theme/types';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAccentColor() {
  const colorScheme = useColorScheme();
  const accent = useSyncExternalStore(
    subscribeAccent,
    getAccentPreference,
    () => 'default' as AccentColorMode,
  );

  const accentLabel = formatAccentColorLabel(accent);
  const accentOption = getAccentOption(accent);
  const accentDot = colorScheme === 'dark' ? accentOption.darkDot : accentOption.lightDot;
  const accentPrimary = colorScheme === 'dark' ? accentOption.darkPrimary : accentOption.lightPrimary;

  return {
    accent,
    accentLabel,
    accentDot,
    accentPrimary,
    accentOption,
    setAccent: setAccentPreference,
  };
}
