import { useSyncExternalStore } from 'react';

import type { RobotConnectionState } from '@/features/robot/domain/robot-connection';

import {
  claimWithCode,
  disconnectRobot,
  getRobotConnection,
  hydrateDevices,
  isRobotConnected,
  resetRobotConnection,
  subscribeRobotConnection,
  unpairActive,
} from './robot-connection-store';

export function useRobotConnection(): RobotConnectionState {
  return useSyncExternalStore(
    subscribeRobotConnection,
    getRobotConnection,
    getRobotConnection,
  );
}

export function useIsRobotConnected(): boolean {
  return useSyncExternalStore(
    subscribeRobotConnection,
    isRobotConnected,
    isRobotConnected,
  );
}

export {
  claimWithCode,
  disconnectRobot,
  hydrateDevices,
  isRobotConnected,
  resetRobotConnection,
  unpairActive,
};
