import type { PersistedAuth } from './types';

export type SessionStore = {
  load(): Promise<PersistedAuth | null>;
  save(value: PersistedAuth): Promise<void>;
  clear(): Promise<void>;
  getOrCreateClientDeviceId(): Promise<string>;
};
