import { useSyncExternalStore } from 'react';

import {
  getWhatsAppSessionState,
  subscribeWhatsAppSession,
} from './whatsapp-session-store';

export function useWhatsAppSession() {
  return useSyncExternalStore(
    subscribeWhatsAppSession,
    getWhatsAppSessionState,
    getWhatsAppSessionState,
  );
}
