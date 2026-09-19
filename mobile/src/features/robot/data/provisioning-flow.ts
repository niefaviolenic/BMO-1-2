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
  CHR_WIFI_SCAN_UUID,
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
  wifiScanCompleted: boolean;
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
  wifiScanCompleted: false,
  discoveredNetworks: [],
  selectedNetwork: null,
  error: null,
};

export class JoyProvisioningManager {
  private state: ProvisioningSessionState = { ...INITIAL_PROVISIONING_SESSION };
  private listeners = new Set<(state: ProvisioningSessionState) => void>();
  private proofSubscriptionCleanup: (() => void) | null = null;
  private proofPollingCleanup: (() => void) | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionEpoch = 0;
  private wifiScanEpoch = 0;
  private isWifiScanningInternal = false;
  private nextScanId = Date.now() >>> 0;

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
    this.sessionEpoch++;
    this.wifiScanEpoch++;
    this.isWifiScanningInternal = false;
    this.clearScanTimer();
    this.cleanupProof();
    bleClient.disconnect().catch(() => {});
    this.updateState({ ...INITIAL_PROVISIONING_SESSION });
  }

  private cleanupProof(): void {
    if (this.proofSubscriptionCleanup) {
      this.proofSubscriptionCleanup();
      this.proofSubscriptionCleanup = null;
    }
    if (this.proofPollingCleanup) {
      this.proofPollingCleanup();
      this.proofPollingCleanup = null;
    }
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
    const currentEpoch = ++this.sessionEpoch;
    this.stopScanning();
    this.wifiScanEpoch++;
    this.isWifiScanningInternal = false;
    this.cleanupProof();
    this.updateState({
      ...INITIAL_PROVISIONING_SESSION,
      discoveredJoys: this.state.discoveredJoys,
      selectedJoy: joy,
      step: 'selected',
    });

    try {
      // 1. Connect GATT over BLE
      await bleClient.connect(joy.id);
      if (this.sessionEpoch !== currentEpoch) return;

      // 2. Read Identity & Setup Nonce from GATT Char 1
      const idInfo = await bleClient.readJson<{
        hw_id: string;
        ref: string;
        nonce: string;
        epoch: number;
        transport_version?: number;
      }>(CHR_IDENTITY_UUID);
      if (this.sessionEpoch !== currentEpoch) return;

      if (!idInfo || !idInfo.hw_id || !idInfo.nonce) {
        throw new Error('Invalid or incomplete hardware identity received from robot via BLE');
      }

      if (idInfo.transport_version !== 2) {
        throw new Error('Pembaruan firmware diperlukan: perangkat tidak mendukung BLE transport v2');
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
      if (this.sessionEpoch !== currentEpoch) return;

      this.updateState({
        prepareData: prepareRes,
        step: 'waiting_physical_confirm',
      });

      // 4. Write Challenge to GATT Char 2
      await bleClient.writeJson(CHR_CHALLENGE_UUID, {
        session_id: prepareRes.session_id,
        challenge: prepareRes.challenge,
      });
      if (this.sessionEpoch !== currentEpoch) return;

      let physicalConfirmed = false;
      const expectedSessionId = prepareRes.session_id;

      const handleProofPayload = async (data: {
        session_id?: string;
        confirm_nonce?: string;
        proof?: string;
      }) => {
        if (physicalConfirmed || this.sessionEpoch !== currentEpoch) return;
        // A readable proof may outlive its BLE connection; bind it to this challenge.
        if (!data || data.session_id !== expectedSessionId) {
          return;
        }
        if (!data.confirm_nonce || !data.proof) {
          return;
        }

        physicalConfirmed = true;
        this.cleanupProof();

        try {
          await this.onPhysicalConfirmationReceived({
            session_id: data.session_id,
            confirmation_nonce: data.confirm_nonce,
            proof: data.proof,
          });
        } catch (confirmErr) {
          // Error captured inside onPhysicalConfirmationReceived; do not leave unhandled rejection
        }
      };

      // 5a. Subscribe to notifications on Char 3 (CHR_PROOF_UUID)
      this.proofSubscriptionCleanup = bleClient.monitorJson<{
        session_id?: string;
        confirm_nonce?: string;
        proof?: string;
      }>(CHR_PROOF_UUID, (data) => {
        void handleProofPayload(data);
      });

      // 5b. Serial polling fallback on CHR_PROOF_UUID (no overlapping reads, with deadline & cleanup)
      let proofPollingActive = true;
      this.proofPollingCleanup = () => {
        proofPollingActive = false;
      };

      (async () => {
        const proofPollStart = Date.now();
        const pollDeadline = proofPollStart + 60_000;

        while (
          proofPollingActive &&
          !physicalConfirmed &&
          this.sessionEpoch === currentEpoch &&
          this.state.step === 'waiting_physical_confirm' &&
          Date.now() < pollDeadline
        ) {
          await delay(250);
          if (
            !proofPollingActive ||
            physicalConfirmed ||
            this.sessionEpoch !== currentEpoch ||
            this.state.step !== 'waiting_physical_confirm'
          ) {
            break;
          }

          try {
            const proofRes = await bleClient.readJson<{
              session_id?: string;
              confirm_nonce?: string;
              proof?: string;
            }>(CHR_PROOF_UUID);

            if (
              !proofPollingActive ||
              physicalConfirmed ||
              this.sessionEpoch !== currentEpoch ||
              this.state.step !== 'waiting_physical_confirm'
            ) {
              break;
            }

            if (
              proofRes &&
              proofRes.session_id === expectedSessionId &&
              proofRes.confirm_nonce &&
              proofRes.proof
            ) {
              await handleProofPayload(proofRes);
              break;
            }
          } catch (readErr) {
            // Serial read poll error, wait for next tick
          }
        }
        if (proofPollingActive && !physicalConfirmed && this.sessionEpoch === currentEpoch) {
          this.cleanupProof();
          this.updateState({ step: 'error', error: 'Konfirmasi tombol 2 detik melewati batas waktu. Mulai pairing lagi.' });
        }
      })().catch(() => {});
    } catch (err: unknown) {
      if (this.sessionEpoch !== currentEpoch) return;
      const msg = err instanceof Error ? err.message : 'Failed to prepare provisioning with device';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }

  async onPhysicalConfirmationReceived(confirmation: {
    session_id: string;
    confirmation_nonce: string;
    proof: string;
  }): Promise<void> {
    const currentEpoch = this.sessionEpoch;
    if (!this.state.selectedJoy || !this.state.prepareData) {
      throw new Error('No active prepare session found');
    }

    if (
      confirmation.session_id !== this.state.prepareData.session_id
    ) {
      throw new Error(
        `Proof session mismatch: expected ${this.state.prepareData.session_id}, got ${confirmation.session_id}`
      );
    }

    if (!confirmation.confirmation_nonce || !confirmation.proof) {
      throw new Error('Invalid physical proof payload received from robot');
    }

    const activeSessionId = this.state.prepareData.session_id;

    try {
      // 6. Confirm with Backend API
      const confirmRes = await confirmProvisioning({
        session_id: activeSessionId,
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

      // Never advance WiFi until backend confirm succeeds for current session
      if (
        this.sessionEpoch !== currentEpoch ||
        this.state.prepareData?.session_id !== activeSessionId
      ) {
        return;
      }

      this.updateState({
        confirmData: confirmRes,
        step: 'entering_wifi_password',
        isWifiScanning: true,
        wifiScanCompleted: false,
        error: null,
      });
      void this.requestDeviceWifiScan();
    } catch (err: unknown) {
      if (this.sessionEpoch !== currentEpoch) return;
      const msg = err instanceof Error ? err.message : 'Physical confirmation failed';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }

  async requestDeviceWifiScan(options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<void> {
    if (this.isWifiScanningInternal) return;
    this.isWifiScanningInternal = true;
    const currentEpoch = this.sessionEpoch;
    const currentScanEpoch = ++this.wifiScanEpoch;
    const isCurrent = () =>
      this.sessionEpoch === currentEpoch && this.wifiScanEpoch === currentScanEpoch;
    const scanId = this.nextScanId = (this.nextScanId + 1) >>> 0;
    type ScanReply = {
      scan_id: number;
      status: 'IDLE' | 'SCANNING' | 'READY' | 'ERROR';
      index: number;
      total: number;
      network: DiscoveredWifiNetwork | null;
      error_code?: string | null;
    };

    this.updateState({
      isWifiScanning: true,
      wifiScanCompleted: false,
      discoveredNetworks: [],
      selectedNetwork: null,
      error: null,
    });
    try {
      console.log('[BLE] Wi-Fi scan requested:', scanId);
      await bleClient.writeJson(CHR_WIFI_SCAN_UUID, { op: 'scan', scan_id: scanId });
      if (!isCurrent()) return;
      const deadline = Date.now() + (options?.timeoutMs ?? 15_000);
      let ready: ScanReply | null = null;
      while (Date.now() < deadline) {
        await delay(options?.pollIntervalMs ?? 250);
        if (!isCurrent()) return;
        const reply = await bleClient.readJson<ScanReply>(CHR_WIFI_SCAN_UUID);
        if (!isCurrent()) return;
        if (reply?.scan_id !== scanId) continue;
        if (reply.status === 'ERROR') {
          throw new Error(`Pemindaian Wi-Fi robot gagal: ${reply.error_code ?? 'SCAN_ERROR'}`);
        }
        if (reply.status === 'READY') {
          if (!Number.isInteger(reply.total) || reply.total < 0 || reply.total > 12) {
            throw new Error('Jumlah jaringan dari robot tidak valid');
          }
          ready = reply;
          break;
        }
      }
      if (!ready) throw new Error('Pemindaian Wi-Fi robot melewati batas waktu');

      const networks: DiscoveredWifiNetwork[] = [];
      for (let index = 0; index < ready.total; index++) {
        if (!isCurrent()) return;
        await bleClient.writeJson(CHR_WIFI_SCAN_UUID, { op: 'page', scan_id: scanId, index });
        if (!isCurrent()) return;
        const page = await bleClient.readJson<ScanReply>(CHR_WIFI_SCAN_UUID);
        if (!isCurrent()) return;
        if (page?.scan_id !== scanId || page.index !== index ||
            page.status !== 'READY' || page.total !== ready.total || !page.network?.ssid) {
          throw new Error(`Halaman jaringan Wi-Fi ${index + 1} tidak valid`);
        }
        networks.push(page.network);
      }
      if (!isCurrent()) return;
      console.log('[BLE] Wi-Fi scan ready:', scanId, 'networks:', networks.length);
      this.setDiscoveredWifiNetworks(networks);
    } catch (err: unknown) {
      if (!isCurrent()) return;
      const detail = err instanceof Error ? err.message : String(err);
      this.updateState({
        isWifiScanning: false,
        wifiScanCompleted: false,
        error: `Gagal membaca Wi-Fi dari robot. Periksa koneksi Bluetooth lalu coba lagi. ${detail}`,
        step: 'entering_wifi_password',
      });
      console.warn('[BLE] Wi-Fi scan failed:', scanId, detail);
    } finally {
      if (isCurrent()) this.isWifiScanningInternal = false;
    }
  }

  setDiscoveredWifiNetworks(networks: DiscoveredWifiNetwork[]): void {
    const currentSelected = this.state.selectedNetwork;
    const selected =
      currentSelected && networks.some((n) => n.ssid === currentSelected.ssid)
        ? currentSelected
        : networks.length > 0
        ? networks[0]
        : null;

    this.updateState({
      discoveredNetworks: networks,
      selectedNetwork: selected,
      isWifiScanning: false,
      wifiScanCompleted: true,
      error: null,
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
    const currentEpoch = this.sessionEpoch;
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

      if (this.sessionEpoch !== currentEpoch) return;

      // 8. Write Secure Envelope to GATT Char 4
      await bleClient.writeJson(CHR_SECURE_START_UUID, {
        res_id: confirmData.reservation_id,
        iv: envelope.iv,
        ciphertext: envelope.ciphertext,
        tag: envelope.tag,
      });

      if (this.sessionEpoch !== currentEpoch) return;

      // 9. Read Commit Proof from GATT Char 5
      const commitData = await bleClient.readJson<{
        commit_nonce: string;
        commit_proof: string;
        status: string;
      }>(CHR_COMMIT_UUID);

      if (this.sessionEpoch !== currentEpoch) return;

      if (!commitData || !commitData.commit_nonce || !commitData.commit_proof) {
        throw new Error('Failed to retrieve commit proof from robot via BLE');
      }

      // 10. Commit Claim with Backend API
      await commitClaim(confirmData.reservation_id, {
        commit_nonce: commitData.commit_nonce,
        commit_proof: commitData.commit_proof,
      });

      if (this.sessionEpoch !== currentEpoch) return;

      // 11. Poll backend until device is finalized by firmware (or max timeout reached)
      const maxPollAttempts = options?.maxPollAttempts ?? 45;
      const pollIntervalMs = options?.pollIntervalMs ?? 1000;
      let finalized = false;
      let terminalError: string | null = null;

      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        if (this.sessionEpoch !== currentEpoch) return;
        try {
          const statusRes = await getProvisioningStatus(confirmData.reservation_id);
          if (this.sessionEpoch !== currentEpoch) return;

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
          if (this.sessionEpoch !== currentEpoch) return;
          if (
            pollErr instanceof Error &&
            (pollErr.message.includes('404') || pollErr.message.includes('410'))
          ) {
            terminalError = pollErr.message;
            break;
          }
        }
        if (attempt < maxPollAttempts - 1) {
          await delay(pollIntervalMs);
        }
      }

      if (this.sessionEpoch !== currentEpoch) return;

      if (terminalError) {
        throw new Error(terminalError);
      }

      if (!finalized) {
        throw new Error(
          'Robot Wi-Fi configured, but backend finalization timed out. Please check if Joy is online and retry.'
        );
      }

      // 12. Hydrate device registry and complete setup
      await hydrateDevices();
      if (this.sessionEpoch !== currentEpoch) return;

      this.updateState({ step: 'success' });
    } catch (err: unknown) {
      if (this.sessionEpoch !== currentEpoch) return;
      const msg = err instanceof Error ? err.message : 'Wi-Fi connection/commit failed';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }
}

export const provisioningManager = new JoyProvisioningManager();
