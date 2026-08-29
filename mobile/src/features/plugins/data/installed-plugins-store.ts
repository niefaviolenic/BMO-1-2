import { INSTALLED_PLUGINS_LIST } from '@/features/plugins/presentation/plugins-screen/plugins-data';

export type InstalledPlugin = {
  id: string;
  name: string;
};

type Listener = () => void;

let installedPlugins: InstalledPlugin[] = [...INSTALLED_PLUGINS_LIST];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getInstalledPlugins(): InstalledPlugin[] {
  return installedPlugins;
}

export function isPluginInstalled(id: string): boolean {
  return installedPlugins.some((plugin) => plugin.id === id);
}

export function installPlugin(id: string, name: string): void {
  if (installedPlugins.some((plugin) => plugin.id === id)) {
    return;
  }
  installedPlugins = [...installedPlugins, { id, name }];
  emit();
}

export function uninstallPlugin(id: string): void {
  const next = installedPlugins.filter((plugin) => plugin.id !== id);
  if (next.length === installedPlugins.length) {
    return;
  }
  installedPlugins = next;
  emit();
}

export function subscribeInstalledPlugins(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
