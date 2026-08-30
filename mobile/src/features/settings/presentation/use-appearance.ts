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
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    getAppearancePreference,
    () => 'system' as AppearanceMode,
  );
  const resolvedColorScheme = useSyncExternalStore(
    subscribeAppearance,
    getResolvedColorScheme,
    () => 'light' as const,
  );

  const appearanceLabel = formatAppearanceLabel(appearance);

  return {
    appearance,
    appearanceLabel,
    setAppearance: setAppearancePreference,
    resolvedColorScheme,
  };
}
