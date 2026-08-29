import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { isBackendPluginId, isCatalogInstalled } from '../domain/plugin';
import type { CatalogPlugin } from '../domain/plugin';
import { isWhatsAppConnected } from '../domain/whatsapp';

import {
  getCatalogPlugin,
  getPluginCatalogState,
  isBackendPluginInstalled,
  subscribePluginCatalog,
} from './plugin-catalog-store';
import {
  getInstalledPlugins,
  installPlugin as installLocalPlugin,
  isPluginInstalled as isLocalPluginInstalled,
  subscribeInstalledPlugins,
  uninstallPlugin as uninstallLocalPlugin,
  type InstalledPlugin,
} from './installed-plugins-store';
import {
  getSpotifySessionState,
  subscribeSpotifySession,
} from './spotify-session-store';
import {
  getWhatsAppSessionState,
  subscribeWhatsAppSession,
} from './whatsapp-session-store';
let mergedCache: InstalledPlugin[] = [];
let mergedDirty = true;

function isBackendConnected(id: string): boolean {
  if (id === 'whatsapp') {
    const wa = getWhatsAppSessionState();
    if (isWhatsAppConnected(wa.connection?.status)) {
      return true;
    }
  }
  if (id === 'spotify') {
    const sp = getSpotifySessionState();
    if (sp.connection?.status === 'CONNECTED') {
      return true;
    }
  }
  return isBackendPluginInstalled(id);
}

function catalogInstalledPlugins(): InstalledPlugin[] {
  const plugins = getPluginCatalogState().plugins.filter(isCatalogInstalled).map((plugin) => ({
    id: plugin.id,
    name: plugin.title,
  }));
  const seen = new Set(plugins.map((p) => p.id));

  const wa = getWhatsAppSessionState();
  if (isWhatsAppConnected(wa.connection?.status) && !seen.has('whatsapp')) {
    plugins.push({ id: 'whatsapp', name: 'WhatsApp' });
    seen.add('whatsapp');
  }

  const sp = getSpotifySessionState();
  if (sp.connection?.status === 'CONNECTED' && !seen.has('spotify')) {
    plugins.push({ id: 'spotify', name: 'Spotify' });
    seen.add('spotify');
  }

  return plugins;
}

function mergedInstalledPlugins(): InstalledPlugin[] {
  if (!mergedDirty) {
    return mergedCache;
  }

  const local = getInstalledPlugins().filter((plugin) => !isBackendPluginId(plugin.id));
  const backend = catalogInstalledPlugins();
  const seen = new Set(backend.map((plugin) => plugin.id));
  mergedCache = [...backend, ...local.filter((plugin) => !seen.has(plugin.id))];
  mergedDirty = false;
  return mergedCache;
}

function subscribeMerged(listener: () => void): () => void {
  const onChange = () => {
    mergedDirty = true;
    listener();
  };
  const unsubscribeLocal = subscribeInstalledPlugins(onChange);
  const unsubscribeCatalog = subscribePluginCatalog(onChange);
  const unsubscribeWhatsApp = subscribeWhatsAppSession(onChange);
  const unsubscribeSpotify = subscribeSpotifySession(onChange);
  return () => {
    unsubscribeLocal();
    unsubscribeCatalog();
    unsubscribeWhatsApp();
    unsubscribeSpotify();
  };
}

function isInstalled(id: string): boolean {
  if (isBackendPluginId(id)) {
    return isBackendConnected(id);
  }
  return isLocalPluginInstalled(id);
}

export function useInstalledPlugins(): InstalledPlugin[] {
  return useSyncExternalStore(subscribeMerged, mergedInstalledPlugins, mergedInstalledPlugins);
}

export function useIsPluginInstalled(id: string): boolean {
  const getSnapshot = useCallback(() => isInstalled(id), [id]);
  return useSyncExternalStore(subscribeMerged, getSnapshot, getSnapshot);
}

export function useCatalogPlugin(id: string): CatalogPlugin | undefined {
  const snapshot = useSyncExternalStore(
    subscribePluginCatalog,
    getPluginCatalogState,
    getPluginCatalogState,
  );
  return useMemo(
    () => snapshot.plugins.find((plugin) => plugin.id === id),
    [id, snapshot.plugins],
  );
}

export function installPlugin(id: string, name: string): void {
  if (isBackendPluginId(id)) {
    return;
  }
  mergedDirty = true;
  installLocalPlugin(id, name);
}

export function uninstallPlugin(id: string): void {
  if (isBackendPluginId(id)) {
    return;
  }
  mergedDirty = true;
  uninstallLocalPlugin(id);
}

export function isPluginInstalled(id: string): boolean {
  return isInstalled(id);
}

export { getCatalogPlugin };
