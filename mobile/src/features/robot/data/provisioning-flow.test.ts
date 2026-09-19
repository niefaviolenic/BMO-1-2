import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoyProvisioningManager, type DiscoveredJoy } from './provisioning-flow';
import { bleClient, CHR_IDENTITY_UUID, CHR_PROOF_UUID, CHR_WIFI_SCAN_UUID } from '@/lib/ble/ble-transport';
import { prepareProvisioning, confirmProvisioning, commitClaim, getProvisioningStatus } from './device-api';
import { hydrateDevices } from './robot-connection-store';

vi.mock('@/lib/ble/ble-transport', () => ({
  bleClient: {
    startScan: vi.fn(), stopScan: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    readJson: vi.fn(), writeJson: vi.fn(), monitorJson: vi.fn(),
  },
  CHR_IDENTITY_UUID: 'fe02', CHR_CHALLENGE_UUID: 'fe03', CHR_PROOF_UUID: 'fe04',
  CHR_SECURE_START_UUID: 'fe05', CHR_COMMIT_UUID: 'fe06', CHR_WIFI_SCAN_UUID: 'fe07',
}));
vi.mock('./device-api', () => ({
  prepareProvisioning: vi.fn(), confirmProvisioning: vi.fn(),
  commitClaim: vi.fn(), getProvisioningStatus: vi.fn(),
}));
vi.mock('./robot-connection-store', () => ({ hydrateDevices: vi.fn() }));
vi.mock('@/lib/ble/scheme2-crypto', () => ({
  encryptSessionEnvelope: vi.fn(() => ({ iv: 'iv', ciphertext: 'encrypted', tag: 'tag' })),
}));

const sessionId = '11111111-2222-4333-8444-555555555555';
const reservation = {
  reservation_id: '66666666-7777-4888-8999-aaaaaaaaaaaa', claim_token: 'token',
  secure_start_proof: 'start-proof', expires_at: '2026-09-18T12:05:00Z',
  security: { scheme: 2, username: 'joy:A7F2', proof_of_possession: 'pop' },
};
const proof = { session_id: sessionId, confirmation_nonce: 'nonce', proof: 'proof' };
const joy: DiscoveredJoy = {
  id: 'peripheral', name: 'JOY-A7F2', provisioningRef: 'A7F2',
  hardwareId: '', setupNonce: '', resetEpoch: 0, rssi: -50,
};
const networks = [
  { ssid: 'Office', rssi: -40, security: 'WPA2' },
  { ssid: 'Guest', rssi: -65, security: 'OPEN' },
];

describe('BLE provisioning session boundaries', () => {
  let manager: JoyProvisioningManager;
  let scanId: number;
  let pageIndex: number;
  let notify: (data: unknown) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    scanId = 0;
    pageIndex = 0;
    notify = () => {};
    vi.mocked(bleClient.disconnect).mockResolvedValue(undefined);
    vi.mocked(bleClient.connect).mockResolvedValue(undefined);
    vi.mocked(bleClient.monitorJson).mockImplementation((_uuid, callback) => {
      notify = callback;
      return () => {};
    });
    vi.mocked(bleClient.writeJson).mockImplementation(async (uuid, payload) => {
      if (uuid === CHR_WIFI_SCAN_UUID) {
        const command = payload as { scan_id: number; index?: number };
        scanId = command.scan_id;
        pageIndex = command.index ?? 0;
      }
    });
    vi.mocked(bleClient.readJson).mockImplementation(async (uuid) => {
      if (uuid === CHR_IDENTITY_UUID) return {
        hw_id: 'joy-hardware', ref: 'A7F2', nonce: 'setup', epoch: 42, transport_version: 2,
      };
      if (uuid === CHR_PROOF_UUID) return { session_id: sessionId, confirm_nonce: '', proof: '' };
      if (uuid === CHR_WIFI_SCAN_UUID) return {
        scan_id: scanId, status: 'READY', index: pageIndex, total: networks.length,
        network: networks[pageIndex],
      };
      return { commit_nonce: 'commit', commit_proof: 'proof', status: 'CONNECTING' };
    });
    vi.mocked(prepareProvisioning).mockResolvedValue({
      session_id: sessionId, challenge: 'challenge', expires_at: '2026-09-18T12:01:00Z',
    });
    vi.mocked(confirmProvisioning).mockResolvedValue(reservation);
    vi.mocked(commitClaim).mockResolvedValue({ status: 'COMMITTED', reservation_id: reservation.reservation_id });
    vi.mocked(getProvisioningStatus).mockResolvedValue({
      status: 'COMPLETED', hardware_id: 'joy-hardware', device_id: 'device', updated_at: '',
    });
    manager = new JoyProvisioningManager();
  });

  afterEach(async () => {
    manager.reset();
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  async function scan() {
    const pending = manager.requestDeviceWifiScan();
    await vi.advanceTimersByTimeAsync(300);
    await pending;
  }

  async function confirm() {
    await manager.selectJoy({ ...joy });
    await manager.onPhysicalConfirmationReceived(proof);
    await vi.advanceTimersByTimeAsync(300);
  }

  it('waits for fresh session proof and backend approval before starting Wi-Fi', async () => {
    const pending = Promise.withResolvers<typeof reservation>();
    vi.mocked(confirmProvisioning).mockReturnValueOnce(pending.promise);
    await manager.selectJoy({ ...joy });
    notify({ session_id: 'old-session', confirm_nonce: 'old', proof: 'old' });
    notify({ confirm_nonce: 'unbound', proof: 'unbound' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.getState().step).toBe('waiting_physical_confirm');
    expect(confirmProvisioning).not.toHaveBeenCalled();
    expect(scanId).toBe(0);
    notify({ session_id: sessionId, confirm_nonce: 'new', proof: 'new' });
    await vi.advanceTimersByTimeAsync(0);
    expect(manager.getState().step).toBe('waiting_physical_confirm');
    expect(scanId).toBe(0);
    pending.resolve(reservation);
    await vi.advanceTimersByTimeAsync(300);
    expect(manager.getState().discoveredNetworks).toEqual(networks);
    expect(manager.getState().error).toBeNull();
  });

  it('does not continue when backend rejects physical proof', async () => {
    vi.mocked(confirmProvisioning).mockRejectedValueOnce(new Error('Invalid physical confirmation proof'));
    await manager.selectJoy({ ...joy });
    notify({ session_id: sessionId, confirm_nonce: 'bad', proof: 'bad' });
    await vi.advanceTimersByTimeAsync(300);
    expect(manager.getState().step).toBe('error');
    expect(manager.getState().confirmData).toBeNull();
    expect(scanId).toBe(0);
  });

  it('expires confirmation rather than leaving the waiting screen forever', async () => {
    await manager.selectJoy({ ...joy });
    await vi.advanceTimersByTimeAsync(60_100);
    expect(manager.getState().step).toBe('error');
    expect(manager.getState().error).toBeTruthy();
    expect(scanId).toBe(0);
  });

  it('discards late backend confirmation after reset', async () => {
    const pending = Promise.withResolvers<typeof reservation>();
    vi.mocked(confirmProvisioning).mockReturnValueOnce(pending.promise);
    await manager.selectJoy({ ...joy });
    const confirming = manager.onPhysicalConfirmationReceived(proof);
    manager.reset();
    pending.resolve(reservation);
    await confirming;
    expect(manager.getState().step).toBe('idle');
    expect(manager.getState().confirmData).toBeNull();
    expect(scanId).toBe(0);
  });

  it('retrieves every page of the current scan', async () => {
    await scan();
    expect(manager.getState().discoveredNetworks).toEqual(networks);
    expect(manager.getState().selectedNetwork).toEqual(networks[0]);
    expect(manager.getState().wifiScanCompleted).toBe(true);
  });

  it('distinguishes a valid empty scan from a transport failure', async () => {
    vi.mocked(bleClient.readJson).mockImplementation(async () => ({
      scan_id: scanId, status: 'READY', index: 0, total: 0, network: null,
    }));
    await scan();
    expect(manager.getState().wifiScanCompleted).toBe(true);
    expect(manager.getState().discoveredNetworks).toEqual([]);
    expect(manager.getState().error).toBeNull();
    vi.mocked(bleClient.readJson).mockRejectedValueOnce(new Error('Device is not connected'));
    await scan();
    expect(manager.getState().wifiScanCompleted).toBe(false);
    expect(manager.getState().error).toContain('Device is not connected');
    expect(manager.getState().isWifiScanning).toBe(false);
  });

  it('reports firmware scan errors without converting them to empty success', async () => {
    vi.mocked(bleClient.readJson).mockImplementation(async () => ({
      scan_id: scanId, status: 'ERROR', error_code: 'SCAN_START_FAILED',
    }));
    await scan();
    expect(manager.getState().error).toContain('SCAN_START_FAILED');
    expect(manager.getState().wifiScanCompleted).toBe(false);
  });

  it('ignores stale scan IDs until a bounded timeout', async () => {
    vi.mocked(bleClient.readJson).mockResolvedValue({ scan_id: 0, status: 'READY', total: 0 });
    const pending = manager.requestDeviceWifiScan({ timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(600);
    await pending;
    expect(manager.getState().wifiScanCompleted).toBe(false);
    expect(manager.getState().error).toBeTruthy();
  });

  it('rejects a mismatched page rather than displaying an incomplete network list', async () => {
    vi.mocked(bleClient.readJson).mockImplementation(async () => ({
      scan_id: scanId, status: 'READY', total: 2, index: 0, network: networks[0],
    }));
    await scan();
    expect(manager.getState().wifiScanCompleted).toBe(false);
    expect(manager.getState().discoveredNetworks).toEqual([]);
    expect(manager.getState().error).toBeTruthy();
  });

  it('keeps one scan active and discards its result after reset', async () => {
    const pending = Promise.withResolvers<unknown>();
    vi.mocked(bleClient.readJson).mockReturnValueOnce(pending.promise);
    const first = manager.requestDeviceWifiScan();
    await vi.advanceTimersByTimeAsync(300);
    await manager.requestDeviceWifiScan();
    const firstId = scanId;
    manager.reset();
    const second = manager.requestDeviceWifiScan();
    const secondId = scanId;
    expect(secondId).not.toBe(firstId);
    pending.resolve({ scan_id: firstId, status: 'READY', total: 0 });
    await first;
    await manager.requestDeviceWifiScan();
    expect(scanId).toBe(secondId);
    await vi.advanceTimersByTimeAsync(300);
    await second;
    expect(manager.getState().discoveredNetworks).toEqual(networks);
  });

  it('commits Wi-Fi and completes only after backend finalization', async () => {
    await confirm();
    manager.selectWifiNetwork({ ssid: 'Guest', rssi: -65, security: 'OPEN' });
    await manager.submitWifiCredentials('');
    expect(manager.getState().step).toBe('success');
    expect(hydrateDevices).toHaveBeenCalledOnce();
  });

  it('reports cancelled reservations rather than setup success', async () => {
    await confirm();
    vi.mocked(getProvisioningStatus).mockResolvedValueOnce({
      status: 'CANCELLED', hardware_id: 'joy-hardware', device_id: null, updated_at: '',
    });
    await expect(manager.submitWifiCredentials('password')).rejects.toThrow('cancelled');
    expect(manager.getState().step).toBe('error');
    expect(hydrateDevices).not.toHaveBeenCalled();
  });
});
