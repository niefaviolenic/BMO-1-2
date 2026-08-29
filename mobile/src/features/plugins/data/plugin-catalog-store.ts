import {
  isIntegrationStatusEvent,
  subscribeMobileWebSocket,
  type MobileInboundEvent,
} from '@/lib/api';

import type { CatalogPlugin } from '../domain/plugin';
import { isCatalogInstalled } from '../domain/plugin';

import { fetchPluginCatalog } from './plugin-api';

type Listener = () => void;

export type PluginCatalogStoreState = {
  plugins: CatalogPlugin[];
  isLoading: boolean;
  isMutating: boolean;
};

type PluginCatalogStoreBucket = {
  listeners: Set<Listener>;
  state: PluginCatalogStoreState;
  loadGeneration: number;
  wsBound: boolean;
};

const STORE_KEY = '__joyPluginCatalogStore';

function bucket(): PluginCatalogStoreBucket {
  const globalRef = globalThis as typeof globalThis & {
    [STORE_KEY]?: PluginCatalogStoreBucket;
  };
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = {
      listeners: new Set<Listener>(),
      state: {
        plugins: [],
        isLoading: false,
        isMutating: false,
      },
      loadGeneration: 0,
      wsBound: false,
    };
  }
  return globalRef[STORE_KEY];
}

function emit(): void {
  bucket().listeners.forEach((listener) => listener());
}

function setState(patch: Partial<PluginCatalogStoreState>): void {
  const store = bucket();
  store.state = { ...store.state, ...patch };
  emit();
}

export function getPluginCatalogState(): PluginCatalogStoreState {
  return bucket().state;
}

export function getCatalogPlugin(id: string): CatalogPlugin | undefined {
  return bucket().state.plugins.find((plugin) => plugin.id === id);
}

export function isBackendPluginInstalled(id: string): boolean {
  return isCatalogInstalled(getCatalogPlugin(id));
}

export function subscribePluginCatalog(listener: Listener): () => void {
  const store = bucket();
  store.listeners.add(listener);
  bindWebSocket();
  return () => {
    store.listeners.delete(listener);
  };
}

export async function refreshPluginCatalog(): Promise<void> {
  const store = bucket();
  const generation = ++store.loadGeneration;
  setState({ isLoading: true });
  try {
    const plugins = await fetchPluginCatalog();
    if (generation !== store.loadGeneration) {
      return;
    }
    setState({ plugins, isLoading: false });
  } catch (error) {
    if (generation !== store.loadGeneration) {
      return;
    }
    setState({ isLoading: false });
    throw error;
  }
}

export function setCatalogMutating(isMutating: boolean): void {
  setState({ isMutating });
}

export function markCatalogPluginDisconnected(id: string): void {
  const plugins = bucket().state.plugins.map((plugin) =>
    plugin.id === id ? { ...plugin, installed: false, status: 'DISCONNECTED' as const } : plugin,
  );
  setState({ plugins });
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (!isIntegrationStatusEvent(event)) {
    return;
  }
  if (bucket().state.isMutating) {
    return;
  }
  void refreshPluginCatalog().catch(() => undefined);
}

function bindWebSocket(): void {
  const store = bucket();
  if (store.wsBound) {
    return;
  }
  store.wsBound = true;
  subscribeMobileWebSocket(handleRealtimeEvent);
}
