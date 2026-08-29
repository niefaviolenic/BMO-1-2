import { useSyncExternalStore } from 'react';

import {
  getPluginCatalogState,
  subscribePluginCatalog,
} from './plugin-catalog-store';

export function usePluginCatalog() {
  return useSyncExternalStore(
    subscribePluginCatalog,
    getPluginCatalogState,
    getPluginCatalogState,
  );
}
