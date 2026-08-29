import { useSyncExternalStore } from 'react';

import {
  getAppearancePreference,
  getResolvedColorScheme,
  setAppearancePreference,
  subscribeAppearance,
} from '../data/appearance-store';
import {
  formatAppearanceLabel,
  type AppearanceMode,
} from '../domain/theme/types';

export function useAppearance() {
  let appearance: AppearanceMode = 'system';
  let resolvedColorScheme: 'light' | 'dark' = 'light';
  try {
    appearance = useSyncExternalStore(
      subscribeAppearance,
      getAppearancePreference,
      () => 'system' as AppearanceMode,
    );
    resolvedColorScheme = useSyncExternalStore(
      subscribeAppearance,
      getResolvedColorScheme,
      () => 'light' as const,
    );
  } catch {
    appearance = getAppearancePreference();
    resolvedColorScheme = getResolvedColorScheme();
  }

  const appearanceLabel = formatAppearanceLabel(appearance);

  return {
    appearance,
    appearanceLabel,
    setAppearance: setAppearancePreference,
    resolvedColorScheme,
  };
}
