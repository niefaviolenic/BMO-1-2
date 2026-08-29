import { useSyncExternalStore } from 'react';

import {
  getResolvedColorScheme,
  subscribeAppearance,
} from '@/features/settings/data/appearance-store';

const emptySubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme(): 'light' | 'dark' {
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const resolvedScheme = useSyncExternalStore(
    subscribeAppearance,
    getResolvedColorScheme,
    () => 'light' as const,
  );

  return hasHydrated ? resolvedScheme : 'light';
}
