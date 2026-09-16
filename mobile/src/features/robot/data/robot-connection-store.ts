import {
  isDeviceStatusEvent,
  isDeviceBindingRevokedEvent,
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
  const telemetry = await getDeviceTelemetry(device.id).catch(() => null);

  return mergeLive(device, {
    online: telemetry?.wifiConnected === true,
    batteryPercent: telemetry?.batteryPercent ?? null,
    wifiConnected: telemetry?.wifiConnected ?? null,
  });
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (isDeviceBindingRevokedEvent(event)) {
    const remaining = connectionState.devices.filter((d) => d.id !== event.deviceId);
    const nextDevice = remaining.length > 0 ? (remaining.find((d) => d.id === connectionState.activeDeviceId) ?? remaining[0] ?? null) : null;
    setState({
      status: nextDevice ? 'connected' : 'disconnected',
      device: nextDevice,
      devices: remaining,
      activeDeviceId: nextDevice?.id ?? null,
    });
    return;
  }

  if (!isDeviceStatusEvent(event)) {
    return;
  }

  const updatedDevices = connectionState.devices.map((dev) => {
    if (dev.id !== event.deviceId) return dev;
    return toRobotDeviceInfo(dev, {
      online: event.online,
      batteryPercent: typeof event.battery?.percent === 'number' ? event.battery.percent : (event.battery !== undefined ? null : dev.batteryPercent),
      wifiConnected: typeof event.wifi?.connected === 'boolean' ? event.wifi.connected : dev.wifiConnected,
    });
  });

  const current = connectionState.device;
  const updatedCurrent = current?.id === event.deviceId
    ? toRobotDeviceInfo(current, {
        online: event.online,
        batteryPercent: typeof event.battery?.percent === 'number' ? event.battery.percent : (event.battery !== undefined ? null : current.batteryPercent),
        wifiConnected: typeof event.wifi?.connected === 'boolean' ? event.wifi.connected : current.wifiConnected,
      })
    : current;

  setState({
    device: updatedCurrent,
    devices: updatedDevices,
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
    const allDevices = await listDevices();
    const activeList = allDevices.filter(isActiveDevice);
    if (activeList.length === 0) {
      setState({ ...INITIAL_ROBOT_CONNECTION });
      return;
    }

    const enriched = await Promise.all(activeList.map(enrichDevice));
    const primary = enriched[0] ?? null;
    setState({
      status: 'connected',
      device: primary,
      devices: enriched,
      activeDeviceId: primary?.id ?? null,
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

export function setActiveDevice(deviceId: string): void {
  const found = connectionState.devices.find((d) => d.id === deviceId);
  if (found) {
    setState({
      device: found,
      activeDeviceId: found.id,
    });
  }
}

export async function addProvisionedDevice(device: SafeDevice): Promise<void> {
  const enriched = await enrichDevice(device);
  const existing = connectionState.devices.filter((d) => d.id !== device.id);
  const nextDevices = [...existing, enriched];
  setState({
    status: 'connected',
    device: enriched,
    devices: nextDevices,
    activeDeviceId: enriched.id,
    isPairing: false,
    error: null,
  });
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
