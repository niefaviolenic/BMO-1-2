import { isApiError } from '@/lib/api';

export type RobotConnectionStatus = 'disconnected' | 'connected';

export type SafeDevice = {
  id: string;
  hardwareId: string;
  name: string;
  status: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
};

export type RobotDeviceInfo = SafeDevice & {
  online: boolean;
  batteryPercent: number | null;
  wifiConnected: boolean | null;
  wifiStatus: string;
  statusLabel: string;
};

export type RobotConnectionState = {
  status: RobotConnectionStatus;
  device: RobotDeviceInfo | null;
  devices: RobotDeviceInfo[];
  activeDeviceId: string | null;
  isHydrating: boolean;
  isPairing: boolean;
  isUnpairing: boolean;
  error: string | null;
};

export const INITIAL_ROBOT_CONNECTION: RobotConnectionState = {
  status: 'disconnected',
  device: null,
  devices: [],
  activeDeviceId: null,
  isHydrating: false,
  isPairing: false,
  isUnpairing: false,
  error: null,
};

export function isActiveDevice(device: Pick<SafeDevice, 'status'>): boolean {
  return device.status === 'ACTIVE';
}

export function toRobotDeviceInfo(
  device: SafeDevice,
  live: {
    online?: boolean;
    batteryPercent?: number | null;
    wifiConnected?: boolean | null;
  } = {},
): RobotDeviceInfo {
  const wifiConnected = live.wifiConnected ?? null;
  const online = live.online ?? false;

  return {
    ...device,
    online,
    batteryPercent: live.batteryPercent ?? null,
    wifiConnected,
    wifiStatus:
      wifiConnected === true
        ? 'WiFi Active'
        : wifiConnected === false
          ? 'WiFi Offline'
          : 'WiFi Unknown',
    statusLabel: online ? 'Online' : 'Offline',
  };
}

export function mapPairingApiError(error: unknown): string {
  if (error instanceof Error && !isApiError(error) && error.message) {
    return error.message;
  }

  if (isApiError(error)) {
    if (error.code === 'PAIRING_CODE_INVALID_OR_EXPIRED') {
      return 'That pairing code is invalid or expired.';
    }
    if (error.code === 'RATE_LIMITED') {
      return 'Too many pairing attempts. Try again later.';
    }
    if (error.code === 'INVALID_INPUT') {
      return 'Enter the 6-digit code shown on Joy.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    return error.message || 'Unable to pair Joy. Try again.';
  }

  return 'Unable to pair Joy. Try again.';
}

export function mapDeviceApiError(error: unknown): string {
  if (error instanceof Error && !isApiError(error) && error.message) {
    return error.message;
  }

  if (isApiError(error)) {
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    return error.message || 'Unable to update the robot connection. Try again.';
  }

  return 'Unable to update the robot connection. Try again.';
}
