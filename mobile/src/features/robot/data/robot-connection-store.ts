import {
  subscribeMobileWebSocket,
  type MobileInboundEvent,
} from '@/lib/api';

import {
  INITIAL_ROBOT_CONNECTION,
  isActiveDevice,
  mapDeviceApiError,
  mapPairingApiError,
  toRobotDeviceInfo,
  type RobotConnectionState,
  type RobotDeviceInfo,
  type SafeDevice,
} from '../domain/robot-connection';
import {
  claimDevice,
  getDeviceTelemetry,
  getDeviceWifi,
  listDevices,
  unpairDevice,
} from './device-api';

type Listener = () => void;

let connectionState: RobotConnectionState = { ...INITIAL_ROBOT_CONNECTION };
let wsBound = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<RobotConnectionState>): void {
  connectionState = { ...connectionState, ...patch };
  emit();
}

function mergeLive(
  device: SafeDevice,
  live: Parameters<typeof toRobotDeviceInfo>[1] = {},
): RobotDeviceInfo {
  const previous = connectionState.device?.id === device.id ? connectionState.device : null;
  return toRobotDeviceInfo(device, {
    online: live.online ?? previous?.online,
    batteryPercent: live.batteryPercent ?? previous?.batteryPercent ?? null,
    wifiConnected: live.wifiConnected ?? previous?.wifiConnected ?? null,
  });
}

async function enrichDevice(device: SafeDevice): Promise<RobotDeviceInfo> {
  const [telemetryResult, wifiResult] = await Promise.allSettled([
    getDeviceTelemetry(device.id),
    getDeviceWifi(device.id),
  ]);

  const telemetry = telemetryResult.status === 'fulfilled' ? telemetryResult.value : null;
  const wifi = wifiResult.status === 'fulfilled' ? wifiResult.value : null;
  const wifiConnected =
    telemetry?.wifiConnected ??
    (wifi?.status === 'CONNECTED' ? true : wifi?.status ? false : null);

  return mergeLive(device, {
    online: telemetry?.wifiConnected === true,
    batteryPercent: telemetry?.batteryPercent ?? null,
    wifiConnected,
  });
}

function isDeviceStatusEvent(event: MobileInboundEvent): event is MobileInboundEvent & {
  event: 'device_status';
  deviceId: string;
  online: boolean;
  wifi?: { connected?: boolean };
  battery?: { percent?: number | null };
} {
  return event.event === 'device_status';
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (!isDeviceStatusEvent(event)) {
    return;
  }

  const current = connectionState.device;
  if (!current || current.id !== event.deviceId) {
    return;
  }

  setState({
    device: toRobotDeviceInfo(current, {
      online: event.online,
      batteryPercent:
        typeof event.battery?.percent === 'number'
          ? event.battery.percent
          : current.batteryPercent,
      wifiConnected:
        typeof event.wifi?.connected === 'boolean'
          ? event.wifi.connected
          : current.wifiConnected,
    }),
  });
}

function bindWebSocket(): void {
  if (wsBound) {
    return;
  }
  wsBound = true;
  subscribeMobileWebSocket(handleRealtimeEvent);
}

export function getRobotConnection(): RobotConnectionState {
  return connectionState;
}

export function isRobotConnected(): boolean {
  return connectionState.status === 'connected' && connectionState.device != null;
}

export function getActiveRobotDeviceId(): string | null {
  return isRobotConnected() ? connectionState.device?.id ?? null : null;
}

export function subscribeRobotConnection(listener: Listener): () => void {
  listeners.add(listener);
  bindWebSocket();
  return () => {
    listeners.delete(listener);
  };
}

export async function hydrateDevices(): Promise<void> {
  bindWebSocket();
  setState({ isHydrating: true, error: null });
  try {
    const devices = await listDevices();
    const active = devices.find(isActiveDevice) ?? null;
    if (!active) {
      setState({ ...INITIAL_ROBOT_CONNECTION });
      return;
    }

    const device = await enrichDevice(active);
    setState({
      status: 'connected',
      device,
      isHydrating: false,
      isPairing: false,
      isUnpairing: false,
      error: null,
    });
  } catch (error) {
    setState({
      isHydrating: false,
      error: mapDeviceApiError(error),
    });
  }
}

export async function claimWithCode(code: string): Promise<void> {
  setState({ isPairing: true, error: null });
  try {
    const claimed = await claimDevice(code);
    const device = await enrichDevice(claimed);
    setState({
      status: 'connected',
      device,
      isPairing: false,
      isHydrating: false,
      isUnpairing: false,
      error: null,
    });
  } catch (error) {
    setState({
      isPairing: false,
      error: mapPairingApiError(error),
    });
    throw error;
  }
}

export async function unpairActive(): Promise<void> {
  const device = connectionState.device;
  if (!device) {
    setState({ ...INITIAL_ROBOT_CONNECTION });
    return;
  }

  setState({ isUnpairing: true, error: null });
  try {
    await unpairDevice(device.id);
    setState({ ...INITIAL_ROBOT_CONNECTION });
  } catch (error) {
    setState({
      isUnpairing: false,
      error: mapDeviceApiError(error),
    });
    throw error;
  }
}

export function resetRobotConnection(): void {
  connectionState = { ...INITIAL_ROBOT_CONNECTION };
  emit();
}

export async function disconnectRobot(): Promise<void> {
  await unpairActive();
}
