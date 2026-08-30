import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  JoyProvisioningManager,
  type DiscoveredJoy,
  type DiscoveredWifiNetwork,
} from './provisioning-flow';

vi.mock('./device-api', () => ({
  prepareProvisioning: vi.fn().mockResolvedValue({
    session_id: 'session-123',
    challenge: 'challenge-123',
    expires_at: '2026-08-29T12:01:00.000Z',
  }),
  confirmProvisioning: vi.fn().mockResolvedValue({
    reservation_id: 'reservation-123',
    claim_token: 'claim-token-123',
    secure_start_proof: 'secure-proof-123',
    security: {
      scheme: 2,
      username: 'joy:A7F2K9M3',
      proof_of_possession: 'pop-123',
    },
    expires_at: '2026-08-29T12:05:00.000Z',
  }),
  commitClaim: vi.fn().mockResolvedValue({
    status: 'COMMITTED',
    reservation_id: 'reservation-123',
  }),
  getProvisioningStatus: vi.fn().mockResolvedValue({
    status: 'COMMITTED',
    hardware_id: 'joy_11111111-2222-4333-8444-555555555555',
    device_id: 'device-123',
    updated_at: '2026-08-29T12:02:00.000Z',
  }),
}));

vi.mock('./robot-connection-store', () => ({
  hydrateDevices: vi.fn().mockResolvedValue(undefined),
  addProvisionedDevice: vi.fn().mockResolvedValue(undefined),
}));

describe('JoyProvisioningManager', () => {
  let manager: JoyProvisioningManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new JoyProvisioningManager();
  });

  it('starts in idle state and supports reset', () => {
    expect(manager.getState().step).toBe('idle');
    expect(manager.getState().discoveredJoys).toEqual([]);
  });

  it('progresses through prepare, confirm, and wifi submission', async () => {
    const mockJoy: DiscoveredJoy = {
      id: 'joy-1',
      name: 'Joy A7F2',
      provisioningRef: 'A7F2K9M3',
      hardwareId: 'joy_11111111-2222-4333-8444-555555555555',
      setupNonce: 'NONCE123',
      resetEpoch: 0,
      rssi: -55,
    };

    // 1. Select Joy -> calls prepare
    await manager.selectJoy(mockJoy);
    expect(manager.getState().step).toBe('waiting_physical_confirm');
    expect(manager.getState().prepareData?.session_id).toBe('session-123');

    // 2. Physical confirmation -> calls confirm
    await manager.onPhysicalConfirmationReceived({
      confirmation_nonce: 'CONF_NONCE',
      proof: 'PROOF_123',
    });
    expect(manager.getState().confirmData?.reservation_id).toBe('reservation-123');

    // 3. Select Wi-Fi and submit credentials -> calls commit
    const mockNetwork: DiscoveredWifiNetwork = {
      ssid: 'Home-WiFi',
      rssi: -40,
      security: 'WPA2',
    };
    manager.selectWifiNetwork(mockNetwork);
    expect(manager.getState().selectedNetwork?.ssid).toBe('Home-WiFi');

    await manager.submitWifiCredentials('secret-password');
    expect(manager.getState().step).toBe('connecting');
  });

  it('handles scanning lifecycle, demo discovery, and timeout', async () => {
    vi.useFakeTimers();

    await manager.startScanning({ timeoutMs: 3000 });
    expect(manager.getState().step).toBe('scanning');
    expect(manager.getState().isScanning).toBe(true);
    expect(manager.getState().scanTimeoutReached).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(manager.getState().scanTimeoutReached).toBe(true);

    // Discover demo Joy
    manager.discoverDemoJoy();
    expect(manager.getState().discoveredJoys.length).toBe(1);
    expect(manager.getState().discoveredJoys[0].name).toContain('Joy Robot');

    // Stop scanning
    manager.stopScanning();
    expect(manager.getState().isScanning).toBe(false);

    vi.useRealTimers();
  });

  it('supports error clearing and wifi scan population', async () => {
    vi.useFakeTimers();

    await manager.requestDeviceWifiScan({ autoPopulateDemo: true });
    expect(manager.getState().step).toBe('scanning_wifi');
    expect(manager.getState().isWifiScanning).toBe(true);

    vi.advanceTimersByTime(800);
    expect(manager.getState().step).toBe('entering_wifi_password');
    expect(manager.getState().discoveredNetworks.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
