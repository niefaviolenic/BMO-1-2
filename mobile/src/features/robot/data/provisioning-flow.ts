import {
  prepareProvisioning,
  confirmProvisioning,
  commitClaim,
  getProvisioningStatus,
  type ProvisioningPrepareResponse,
  type ProvisioningConfirmResponse,
} from './device-api';
import { hydrateDevices } from './robot-connection-store';
import {
  bleClient,
  CHR_IDENTITY_UUID,
  CHR_CHALLENGE_UUID,
  CHR_PROOF_UUID,
  CHR_SECURE_START_UUID,
  CHR_COMMIT_UUID,
} from '@/lib/ble/ble-transport';
import { encryptSessionEnvelope } from '@/lib/ble/scheme2-crypto';
function delay(ms: number): Promise<void> {
  if (typeof Promise.withResolvers === 'function') {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export interface DiscoveredJoy {
  id: string;
  name: string;
  provisioningRef: string;
  hardwareId: string;
  setupNonce: string;
  resetEpoch: number;
  rssi: number;
}

export interface DiscoveredWifiNetwork {
  ssid: string;
  rssi: number;
  security: 'WPA2' | 'WPA3' | 'OPEN';
}

export type ProvisioningStep =
  | 'idle'
  | 'scanning'
  | 'selected'
  | 'waiting_physical_confirm'
  | 'physical_confirmed'
  | 'scanning_wifi'
  | 'entering_wifi_password'
  | 'connecting'
  | 'success'
  | 'error';

export interface ProvisioningSessionState {
  step: ProvisioningStep;
  isScanning: boolean;
  scanTimeoutReached: boolean;
  discoveredJoys: DiscoveredJoy[];
  selectedJoy: DiscoveredJoy | null;
  prepareData: ProvisioningPrepareResponse | null;
  confirmData: ProvisioningConfirmResponse | null;
  isWifiScanning: boolean;
  discoveredNetworks: DiscoveredWifiNetwork[];
  selectedNetwork: DiscoveredWifiNetwork | null;
  error: string | null;
}

export const INITIAL_PROVISIONING_SESSION: ProvisioningSessionState = {
  step: 'idle',
  isScanning: false,
  scanTimeoutReached: false,
  discoveredJoys: [],
  selectedJoy: null,
  prepareData: null,
  confirmData: null,
  isWifiScanning: false,
  discoveredNetworks: [],
  selectedNetwork: null,
  error: null,
};

export class JoyProvisioningManager {
  private state: ProvisioningSessionState = { ...INITIAL_PROVISIONING_SESSION };
  private listeners = new Set<(state: ProvisioningSessionState) => void>();
  private proofSubscriptionCleanup: (() => void) | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: (state: ProvisioningSessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): ProvisioningSessionState {
    return this.state;
  }

  private updateState(patch: Partial<ProvisioningSessionState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  reset(): void {
    this.clearScanTimer();
    if (this.proofSubscriptionCleanup) {
      this.proofSubscriptionCleanup();
      this.proofSubscriptionCleanup = null;
    }
    bleClient.disconnect().catch(() => {});
    this.updateState({ ...INITIAL_PROVISIONING_SESSION });
  }

  private clearScanTimer(): void {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  setScanTimeoutReached(reached: boolean): void {
    this.updateState({ scanTimeoutReached: reached });
  }

  async startScanning(options?: { timeoutMs?: number }): Promise<void> {
    this.clearScanTimer();
    this.updateState({
      step: 'scanning',
      isScanning: true,
      scanTimeoutReached: false,
      error: null,
      discoveredJoys: [],
    });

    const timeoutMs = options?.timeoutMs ?? 10000;
    this.scanTimer = setTimeout(() => {
      if (this.state.step === 'scanning') {
        this.stopScanning();
        this.updateState({ scanTimeoutReached: true, isScanning: false });
      }
    }, timeoutMs);

    try {
      await bleClient.startScan((device) => {
        const provisioningRef = device.name.replace(/^JOY-/, '');
        this.addDiscoveredJoy({
          id: device.id,
          name: device.name,
          provisioningRef,
          hardwareId: '',
          setupNonce: '',
          resetEpoch: 0,
          rssi: device.rssi,
        });
      });
    } catch (err: unknown) {
      this.clearScanTimer();
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal memulai pemindaian Bluetooth. Pastikan Bluetooth aktif dan didukung.';
      this.updateState({ error: msg, isScanning: false, step: 'error' });
    }
  }

  async restartScanning(options?: { timeoutMs?: number }): Promise<void> {
    this.stopScanning();
    return this.startScanning(options);
  }

  stopScanning(): void {
    this.clearScanTimer();
    bleClient.stopScan();
    this.updateState({ isScanning: false });
  }

  addDiscoveredJoy(joy: DiscoveredJoy): void {
    const existingIndex = this.state.discoveredJoys.findIndex((j) => j.id === joy.id);
    if (existingIndex >= 0) {
      const existing = this.state.discoveredJoys[existingIndex];
      if (existing.name !== joy.name || existing.rssi !== joy.rssi) {
        const nextList = [...this.state.discoveredJoys];
        nextList[existingIndex] = {
          ...existing,
          name: joy.name,
          provisioningRef: joy.name.replace(/^JOY-/, ''),
          rssi: joy.rssi,
        };
        this.updateState({ discoveredJoys: nextList });
      }
    } else {
      this.updateState({
        discoveredJoys: [...this.state.discoveredJoys, joy],
      });
    }
  }

  async selectJoy(joy: DiscoveredJoy): Promise<void> {
    this.updateState({ selectedJoy: joy, step: 'selected', error: null });

    try {
      // 1. Connect GATT over BLE
      await bleClient.connect(joy.id);

      // 2. Read Identity & Setup Nonce from GATT Char 1
      const idInfo = await bleClient.readJson<{
        hw_id: string;
        ref: string;
        nonce: string;
        epoch: number;
      }>(CHR_IDENTITY_UUID);

      if (!idInfo || !idInfo.hw_id || !idInfo.nonce) {
        throw new Error('Invalid or incomplete hardware identity received from robot via BLE');
      }

      joy.hardwareId = idInfo.hw_id;
      joy.provisioningRef = idInfo.ref || joy.provisioningRef;
      joy.setupNonce = idInfo.nonce;
      joy.resetEpoch = typeof idInfo.epoch === 'number' ? idInfo.epoch : 0;

      // 3. Prepare session with Backend API
      const prepareRes = await prepareProvisioning({
        protocol_version: 1,
        hardware_id: joy.hardwareId,
        provisioning_ref: joy.provisioningRef,
        setup_nonce: joy.setupNonce,
        reset_epoch: joy.resetEpoch,
      });

      this.updateState({
        prepareData: prepareRes,
        step: 'waiting_physical_confirm',
      });

      // 4. Write Challenge to GATT Char 2
      await bleClient.writeJson(CHR_CHALLENGE_UUID, {
        session_id: prepareRes.session_id,
        challenge: prepareRes.challenge,
      });

      // 5. Monitor physical confirmation notification on GATT Char 3
      this.proofSubscriptionCleanup = bleClient.monitorJson<{
        confirm_nonce: string;
        proof: string;
      }>(CHR_PROOF_UUID, async (data) => {
        if (this.proofSubscriptionCleanup) {
          this.proofSubscriptionCleanup();
          this.proofSubscriptionCleanup = null;
        }
        await this.onPhysicalConfirmationReceived({
          confirmation_nonce: data.confirm_nonce,
          proof: data.proof,
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to prepare provisioning with device';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }

  async onPhysicalConfirmationReceived(confirmation: {
    confirmation_nonce: string;
    proof: string;
  }): Promise<void> {
    if (!this.state.selectedJoy || !this.state.prepareData) {
      throw new Error('No active prepare session found');
    }

    if (!confirmation.confirmation_nonce || !confirmation.proof) {
      throw new Error('Invalid physical proof payload received from robot');
    }

    try {
      // 6. Confirm with Backend API
      const confirmRes = await confirmProvisioning({
        session_id: this.state.prepareData.session_id,
        confirmation: {
          hardware_id: this.state.selectedJoy.hardwareId,
          provisioning_ref: this.state.selectedJoy.provisioningRef,
          setup_nonce: this.state.selectedJoy.setupNonce,
          reset_epoch: this.state.selectedJoy.resetEpoch,
          challenge: this.state.prepareData.challenge,
          confirmation_nonce: confirmation.confirmation_nonce,
          proof: confirmation.proof,
        },
      });
      this.updateState({
        confirmData: confirmRes,
        step: 'entering_wifi_password',
        isWifiScanning: false,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Physical confirmation failed';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }

  requestDeviceWifiScan(): void {
    this.updateState({
      step: 'entering_wifi_password',
      isWifiScanning: false,
      error: null,
      discoveredNetworks: [],
    });
  }
  setDiscoveredWifiNetworks(networks: DiscoveredWifiNetwork[]): void {
    this.updateState({
      discoveredNetworks: networks,
      isWifiScanning: false,
      step: 'entering_wifi_password',
    });
  }

  selectWifiNetwork(network: DiscoveredWifiNetwork): void {
    this.updateState({ selectedNetwork: network });
  }

  async submitWifiCredentials(
    password: string,
    customSsid?: string,
    options?: { pollIntervalMs?: number; maxPollAttempts?: number }
  ): Promise<void> {
    const { selectedJoy, selectedNetwork, confirmData } = this.state;
    const ssid = customSsid || selectedNetwork?.ssid;
    if (!ssid || !selectedJoy || !confirmData) {
      throw new Error('Missing network selection or session data');
    }

    this.updateState({ step: 'connecting', error: null });

    try {
      const aadString = `${selectedJoy.hardwareId}|${selectedJoy.provisioningRef}|${confirmData.reservation_id}`;

      // 7. Encrypt payload via Security Scheme 2 Envelope (AES-256-GCM)
      const envelope = encryptSessionEnvelope(
        confirmData.security.proof_of_possession,
        selectedJoy.setupNonce,
        aadString,
        {
          res_id: confirmData.reservation_id,
          token: confirmData.claim_token,
          start_proof: confirmData.secure_start_proof,
          ssid,
          pass: password,
        }
      );

      // 8. Write Secure Envelope to GATT Char 4
      await bleClient.writeJson(CHR_SECURE_START_UUID, {
        res_id: confirmData.reservation_id,
        iv: envelope.iv,
        ciphertext: envelope.ciphertext,
        tag: envelope.tag,
      });
      // 9. Read Commit Proof from GATT Char 5
      const commitData = await bleClient.readJson<{
        commit_nonce: string;
        commit_proof: string;
        status: string;
      }>(CHR_COMMIT_UUID);

      if (!commitData || !commitData.commit_nonce || !commitData.commit_proof) {
        throw new Error('Failed to retrieve commit proof from robot via BLE');
      }

      // 10. Commit Claim with Backend API
      await commitClaim(confirmData.reservation_id, {
        commit_nonce: commitData.commit_nonce,
        commit_proof: commitData.commit_proof,
      });

      // 11. Poll backend until device is finalized by firmware (or max timeout reached)
      const maxPollAttempts = options?.maxPollAttempts ?? 45;
      const pollIntervalMs = options?.pollIntervalMs ?? 1000;
      let finalized = false;
      let terminalError: string | null = null;

      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        try {
          const statusRes = await getProvisioningStatus(confirmData.reservation_id);
          if (
            statusRes.device_id ||
            statusRes.status === 'FINALIZED_PENDING_RUNTIME_ACK' ||
            statusRes.status === 'COMPLETED'
          ) {
            finalized = true;
            break;
          } else if (statusRes.status === 'CANCELLED' || statusRes.status === 'FAILED') {
            terminalError = `Provisioning session was ${statusRes.status.toLowerCase()}`;
            break;
          }
        } catch (pollErr: unknown) {
          if (pollErr instanceof Error && (pollErr.message.includes('404') || pollErr.message.includes('410'))) {
            terminalError = pollErr.message;
            break;
          }
        }
        if (attempt < maxPollAttempts - 1) {
          await delay(pollIntervalMs);
        }
      }

      if (terminalError) {
        throw new Error(terminalError);
      }

      if (!finalized) {
        throw new Error('Robot Wi-Fi configured, but backend finalization timed out. Please check if Joy is online and retry.');
      }
      // 12. Hydrate device registry and complete setup
      await hydrateDevices();
      this.updateState({ step: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wi-Fi connection/commit failed';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }
}

export const provisioningManager = new JoyProvisioningManager();
