import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SafeDevice, DeviceTelemetry } from './device-api';
import { listDevices, getDeviceTelemetry } from './device-api';
import {
  getRobotConnection,
  resetRobotConnection,
  hydrateDevices,
} from './robot-connection-store';
vi.mock('@/lib/api', () => ({
  subscribeMobileWebSocket: vi.fn(),
  isDeviceStatusEvent: vi.fn((e: Record<string, unknown>) => e.event === 'device_status'),
  isDeviceBindingRevokedEvent: vi.fn((e: Record<string, unknown>) => e.event === 'device_binding_revoked'),
  isApiError: vi.fn(() => false),
}));
vi.mock('./device-api', () => ({
  listDevices: vi.fn().mockResolvedValue([]),
  getDeviceTelemetry: vi.fn().mockResolvedValue(null),
}));

describe('Robot Connection Store Battery Truthfulness', () => {
  beforeEach(() => {
    resetRobotConnection();
  });

  it('initializes with null battery percent and disconnected status', () => {
    const conn = getRobotConnection();
    expect(conn.status).toBe('disconnected');
    expect(conn.device).toBeNull();
  });
  it('preserves null battery when telemetry is unsupported or null', () => {
    const conn = getRobotConnection();
    expect(conn.device?.batteryPercent ?? null).toBeNull();
  });

  it('clears stale battery percent to null when re-hydrated telemetry reports null', async () => {
    const mockDevice: SafeDevice = {
      id: 'dev-1',
      hardwareId: 'HW-01',
      name: 'BMO Device',
      status: 'ACTIVE',
      pairedAt: '2026-09-01T00:00:00.000Z',
      lastSeenAt: '2026-09-19T00:00:00.000Z',
    };

    const telemetryWithBattery: DeviceTelemetry = {
      wifiConnected: true,
      batterySupported: true,
      batteryPercent: 85,
      wifiRssi: null,
      firmwareVersion: null,
      observedAt: null,
    };

    const telemetryNullBattery: DeviceTelemetry = {
      wifiConnected: true,
      batterySupported: false,
      batteryPercent: null,
      wifiRssi: null,
      firmwareVersion: null,
      observedAt: null,
    };

    // 1st hydration: reports battery 85%
    vi.mocked(listDevices).mockResolvedValueOnce([mockDevice]);
    vi.mocked(getDeviceTelemetry).mockResolvedValueOnce(telemetryWithBattery);

    await hydrateDevices();
    expect(getRobotConnection().device?.batteryPercent).toBe(85);

    // 2nd hydration: telemetry reports battery is null (unsupported/disconnected)
    vi.mocked(listDevices).mockResolvedValueOnce([mockDevice]);
    vi.mocked(getDeviceTelemetry).mockResolvedValueOnce(telemetryNullBattery);

    await hydrateDevices();
    // Stale 85% must NOT be retained! It must be cleared to null
    expect(getRobotConnection().device?.batteryPercent).toBeNull();
  });
});
