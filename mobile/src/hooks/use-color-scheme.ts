import { useSyncExternalStore } from 'react';

import {
  getResolvedColorScheme,
  subscribeAppearance,
} from '@/features/settings/data/appearance-store';

export function useColorScheme(): 'light' | 'dark' {
  try {
    return useSyncExternalStore(
      subscribeAppearance,
      getResolvedColorScheme,
      () => 'light',
    );
  } catch {
    return getResolvedColorScheme();
  }
}
