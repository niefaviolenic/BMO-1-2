import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  JoyProvisioningManager,
  type DiscoveredJoy,
  type DiscoveredWifiNetwork,
} from './provisioning-flow';
import { bleClient } from '@/lib/ble/ble-transport';
import { prepareProvisioning, confirmProvisioning, commitClaim } from './device-api';

vi.mock('@/lib/ble/ble-transport', () => ({
  bleClient: {
    startScan: vi.fn(async () => {}),
    stopScan: vi.fn(() => {}),
    connect: vi.fn(async () => {}),
    readJson: vi.fn(async (charUuid: string) => {
      if (charUuid.includes('fe02')) {
        return {
          hw_id: 'joy_11111111-2222-4333-8444-555555555555',
          ref: 'A7F2K9M3',
          nonce: 'Q2W8N4P7RX',
          epoch: 0,
        };
      }
      if (charUuid.includes('fe06')) {
        return {
          commit_nonce: 'ICEiIyQlJicoKSorLC0uLw',
          commit_proof: 'EdJA1I8-SE9OJnB29egnVyAAVr1PfLvcaVzmzEpewbA',
          status: 'CONNECTING',
        };
      }
      return {};
    }),
    writeJson: vi.fn(async () => {}),
    monitorJson: vi.fn(() => () => {}),
    disconnect: vi.fn(async () => {}),
  },
  CHR_IDENTITY_UUID: '0000fe02-6a6f-7961-692d-62696e657231',
  CHR_CHALLENGE_UUID: '0000fe03-6a6f-7961-692d-62696e657231',
  CHR_PROOF_UUID: '0000fe04-6a6f-7961-692d-62696e657231',
  CHR_SECURE_START_UUID: '0000fe05-6a6f-7961-692d-62696e657231',
  CHR_COMMIT_UUID: '0000fe06-6a6f-7961-692d-62696e657231',
}));

vi.mock('./device-api', () => ({
  prepareProvisioning: vi.fn().mockResolvedValue({
    session_id: '11111111-2222-4333-8444-555555555555',
    challenge: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
    expires_at: '2026-08-30T12:01:00.000Z',
  }),
  confirmProvisioning: vi.fn().mockResolvedValue({
    reservation_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    claim_token: 'claim-token-test-v4',
    secure_start_proof: 'DLIfz1SgsfGVpppzQbb5rMTcgDVeNNRzEQsfzsNiIj4',
    security: {
      scheme: 2,
      username: 'joy:A7F2K9M3',
      proof_of_possession: 'MQfe7SdddtocXoQ1UaQugp-X6B-8AdhnxYkr8ddsswY',
    },
    expires_at: '2026-08-30T12:05:00.000Z',
  }),
  commitClaim: vi.fn().mockResolvedValue({
    status: 'COMMITTED',
    reservation_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
  }),
  getProvisioningStatus: vi.fn().mockResolvedValue({
    status: 'COMMITTED',
    hardware_id: 'joy_11111111-2222-4333-8444-555555555555',
    device_id: 'dev_01',
    updated_at: '2026-08-30T12:05:00.000Z',
  }),
}));

vi.mock('./robot-connection-store', () => ({
  hydrateDevices: vi.fn().mockResolvedValue(undefined),
  addProvisionedDevice: vi.fn().mockResolvedValue(undefined),
}));

describe('JoyProvisioningManager (Real BLE v4 Implementation)', () => {
  let manager: JoyProvisioningManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new JoyProvisioningManager();
  });

  it('starts in idle state and supports reset', () => {
    expect(manager.getState().step).toBe('idle');
    expect(manager.getState().discoveredJoys).toEqual([]);
    manager.reset();
    expect(bleClient.disconnect).toHaveBeenCalled();
  });

  it('progresses through complete BLE v4 handshake and commit', async () => {
    const mockJoy: DiscoveredJoy = {
      id: 'ble-peripheral-01',
      name: 'JOY-A7F2',
      provisioningRef: 'A7F2',
      hardwareId: '',
      setupNonce: '',
      resetEpoch: 0,
      rssi: -55,
    };

    // 1. Select Joy -> BLE connect, read Char 1, call prepare, write Char 2
    await manager.selectJoy(mockJoy);
    expect(bleClient.connect).toHaveBeenCalledWith('ble-peripheral-01');
    expect(bleClient.readJson).toHaveBeenCalled();
    expect(prepareProvisioning).toHaveBeenCalledWith({
      protocol_version: 1,
      hardware_id: 'joy_11111111-2222-4333-8444-555555555555',
      provisioning_ref: 'A7F2K9M3',
      setup_nonce: 'Q2W8N4P7RX',
      reset_epoch: 0,
    });
    expect(bleClient.writeJson).toHaveBeenCalled();
    expect(manager.getState().step).toBe('waiting_physical_confirm');

    // 2. Physical confirmation received -> confirm with backend
    await manager.onPhysicalConfirmationReceived({
      confirmation_nonce: 'EBESExQVFhcYGRobHB0eHw',
      proof: 'TOmZUKCRvTvowaPBCBMM1ndVLR4GTcwrOXbdydNsdwg',
    });
    expect(confirmProvisioning).toHaveBeenCalled();
    expect(manager.getState().step).toBe('entering_wifi_password');
    expect(manager.getState().confirmData?.reservation_id).toBe('66666666-7777-4888-8999-aaaaaaaaaaaa');

    // 3. Select Wi-Fi and submit credentials -> Encrypt envelope, write Char 4, read Char 5, commit
    const mockNetwork: DiscoveredWifiNetwork = {
      ssid: 'Home-WiFi-2.4G',
      rssi: -40,
      security: 'WPA2',
    };
    manager.setDiscoveredWifiNetworks([mockNetwork]);
    manager.selectWifiNetwork(mockNetwork);
    expect(manager.getState().selectedNetwork?.ssid).toBe('Home-WiFi-2.4G');

    await manager.submitWifiCredentials('superSecretPassword123');
    expect(bleClient.writeJson).toHaveBeenCalled();
    expect(commitClaim).toHaveBeenCalledWith('66666666-7777-4888-8999-aaaaaaaaaaaa', {
      commit_nonce: 'ICEiIyQlJicoKSorLC0uLw',
      commit_proof: 'EdJA1I8-SE9OJnB29egnVyAAVr1PfLvcaVzmzEpewbA',
    });
    expect(manager.getState().step).toBe('success');
  });

  it('fails loudly when BLE connection fails during selectJoy', async () => {
    vi.mocked(bleClient.connect).mockRejectedValueOnce(new Error('BLE connection timed out'));

    const mockJoy: DiscoveredJoy = {
      id: 'ble-peripheral-fail',
      name: 'JOY-FAIL',
      provisioningRef: 'FAIL',
      hardwareId: '',
      setupNonce: '',
      resetEpoch: 0,
      rssi: -90,
    };

    await expect(manager.selectJoy(mockJoy)).rejects.toThrow('BLE connection timed out');
    expect(manager.getState().step).toBe('error');
    expect(manager.getState().error).toBe('BLE connection timed out');
  });

  it('fails loudly when Char 1 identity is incomplete', async () => {
    vi.mocked(bleClient.readJson).mockResolvedValueOnce({
      hw_id: '',
      ref: '',
      nonce: '',
      epoch: 0,
    });

    const mockJoy: DiscoveredJoy = {
      id: 'ble-peripheral-bad-id',
      name: 'JOY-BAD',
      provisioningRef: 'BAD',
      hardwareId: '',
      setupNonce: '',
      resetEpoch: 0,
      rssi: -70,
    };

    await expect(manager.selectJoy(mockJoy)).rejects.toThrow(
      'Invalid or incomplete hardware identity received from robot via BLE'
    );
    expect(manager.getState().step).toBe('error');
  });
});
