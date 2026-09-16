import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getRobotConnection,
  resetRobotConnection,
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
});
