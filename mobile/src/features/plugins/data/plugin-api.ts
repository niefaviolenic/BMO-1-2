import { apiRequest } from '@/lib/api';

import {
  isIntegrationConnected,
  type CatalogPlugin,
  type IntegrationStatus,
} from '../domain/plugin';

type PluginCatalogResponse = {
  items: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asStatus(value: unknown): IntegrationStatus {
  if (
    value === 'CONNECTED' ||
    value === 'DISCONNECTED' ||
    value === 'PENDING' ||
    value === 'ERROR' ||
    value === 'RECONNECT_REQUIRED'
  ) {
    return value;
  }
  return 'DISCONNECTED';
}

function asCatalogPlugin(value: unknown): CatalogPlugin | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  const status = asStatus(value.status);
  const installed =
    typeof value.installed === 'boolean'
      ? value.installed
      : isIntegrationConnected(status);

  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : value.id,
    installed,
    status,
  };
}

export async function fetchPluginCatalog(): Promise<CatalogPlugin[]> {
  const payload = await apiRequest<PluginCatalogResponse>('/plugins');
  return (payload.items ?? []).map(asCatalogPlugin).filter((item): item is CatalogPlugin => item != null);
}
