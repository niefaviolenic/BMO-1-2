import { isApiError } from '@/lib/api/types';

export const BACKEND_PLUGIN_IDS = ['whatsapp', 'spotify'] as const;

export type BackendPluginId = typeof BACKEND_PLUGIN_IDS[number];

export type IntegrationStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'PENDING'
  | 'ERROR'
  | 'RECONNECT_REQUIRED';

export type CatalogPlugin = {
  id: string;
  title: string;
  installed: boolean;
  status: IntegrationStatus;
};

export function isBackendPluginId(id: string): id is BackendPluginId {
  return BACKEND_PLUGIN_IDS.includes(id as BackendPluginId);
}

export function isIntegrationConnected(status: string | undefined): boolean {
  return status === 'CONNECTED';
}

export function isCatalogInstalled(plugin: CatalogPlugin | undefined): boolean {
  return plugin != null && plugin.installed && isIntegrationConnected(plugin.status);
}

export function mapPluginApiError(error: unknown): string {
  if (error instanceof Error && !isApiError(error) && error.message) {
    return error.message;
  }

  if (isApiError(error)) {
    if (error.code === 'PREMIUM_REQUIRED') {
      return error.message || 'Spotify Premium is required to control playback or skip tracks.';
    }
    if (error.code === 'NO_ACTIVE_DEVICE') {
      return error.message || 'Open Spotify on a phone, laptop, or other device first.';
    }
    if (error.code === 'CONFLICT') {
      return error.message || 'This plugin is not ready yet. Try again.';
    }
    if (error.code === 'INVALID_INPUT') {
      return error.message || 'That plugin value is not valid.';
    }
    if (error.code === 'SERVICE_UNAVAILABLE') {
      return error.message || 'This plugin is unavailable. Try again in a moment.';
    }
    if (error.code === 'BLOCKED_EXTERNAL_SECRET') {
      return error.message || 'This plugin is not configured on the server.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    return error.message || 'Unable to update plugins. Try again.';
  }
  return 'Unable to update plugins. Try again.';
}
