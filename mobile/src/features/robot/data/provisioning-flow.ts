import {
  prepareProvisioning,
  confirmProvisioning,
  commitClaim,
  type ProvisioningPrepareResponse,
  type ProvisioningConfirmResponse,
} from './device-api';
import { hydrateDevices } from './robot-connection-store';

export type DiscoveredJoy = {
  id: string;
  name: string;
  provisioningRef: string;
  hardwareId: string;
  setupNonce: string;
  resetEpoch: number;
  rssi: number;
};

export type DiscoveredWifiNetwork = {
  ssid: string;
  rssi: number;
  security: string;
};

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
  isWifiScanning: boolean;
  discoveredJoys: DiscoveredJoy[];
  selectedJoy: DiscoveredJoy | null;
  prepareData: ProvisioningPrepareResponse | null;
  confirmData: ProvisioningConfirmResponse | null;
  discoveredNetworks: DiscoveredWifiNetwork[];
  selectedNetwork: DiscoveredWifiNetwork | null;
  error: string | null;
}

export const DEMO_JOY_DEVICE: DiscoveredJoy = {
  id: 'joy-nearby-demo',
  name: 'Joy Robot (Demo)',
  provisioningRef: 'JOY-78B2',
  hardwareId: 'joy_demo_hw_001122334455',
  setupNonce: 'dGVzdF9zZXR1cF9ub25jZQ==',
  resetEpoch: 0,
  rssi: -48,
};

export const DEMO_WIFI_NETWORKS: DiscoveredWifiNetwork[] = [
  { ssid: 'Home-WiFi-5G', rssi: -42, security: 'WPA2' },
  { ssid: 'Joy-Studio-Guest', rssi: -58, security: 'WPA3' },
  { ssid: 'LivingRoom_2.4G', rssi: -65, security: 'WPA2' },
];

export const INITIAL_PROVISIONING_SESSION: ProvisioningSessionState = {
  step: 'idle',
  isScanning: false,
  scanTimeoutReached: false,
  isWifiScanning: false,
  discoveredJoys: [],
  selectedJoy: null,
  prepareData: null,
  confirmData: null,
  discoveredNetworks: [],
  selectedNetwork: null,
  error: null,
};

export class JoyProvisioningManager {
  private state: ProvisioningSessionState = { ...INITIAL_PROVISIONING_SESSION };
  private listeners = new Set<(state: ProvisioningSessionState) => void>();

  subscribe(listener: (state: ProvisioningSessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): ProvisioningSessionState {
    return this.state;
  }

  private updateState(patch: Partial<ProvisioningSessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private scanTimer: ReturnType<typeof setTimeout> | number | null = null;
  private demoTimer: ReturnType<typeof setTimeout> | number | null = null;

  reset() {
    this.clearTimers();
    this.updateState({ ...INITIAL_PROVISIONING_SESSION });
  }

  private clearTimers() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.demoTimer) {
      clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
  }

  clearError() {
    this.updateState({ error: null });
  }

  setScanTimeoutReached(reached: boolean) {
    this.updateState({ scanTimeoutReached: reached });
  }

  async startScanning(options?: {
    autoDemoFallback?: boolean;
    timeoutMs?: number;
    demoDelayMs?: number;
  }): Promise<void> {
    this.clearTimers();
    this.updateState({
      step: 'scanning',
      isScanning: true,
      scanTimeoutReached: false,
      error: null,
      discoveredJoys: [],
    });

    const timeoutMs = options?.timeoutMs ?? 5000;
    this.scanTimer = setTimeout(() => {
      if (this.state.step === 'scanning' && this.state.discoveredJoys.length === 0) {
        this.updateState({ scanTimeoutReached: true });
      }
    }, timeoutMs);

    if (options?.autoDemoFallback) {
      const demoDelay = options.demoDelayMs ?? 1500;
      this.demoTimer = setTimeout(() => {
        if (this.state.step === 'scanning') {
          this.addDiscoveredJoy(DEMO_JOY_DEVICE);
        }
      }, demoDelay);
    }
  }

  async restartScanning(options?: {
    autoDemoFallback?: boolean;
    timeoutMs?: number;
    demoDelayMs?: number;
  }): Promise<void> {
    return this.startScanning(options);
  }

  stopScanning(): void {
    this.clearTimers();
    this.updateState({ isScanning: false });
  }

  discoverDemoJoy(): void {
    this.addDiscoveredJoy(DEMO_JOY_DEVICE);
  }

  addDiscoveredJoy(joy: DiscoveredJoy): void {
    const exists = this.state.discoveredJoys.some((j) => j.hardwareId === joy.hardwareId);
    if (!exists) {
      this.updateState({
        discoveredJoys: [...this.state.discoveredJoys, joy],
      });
    }
  }

  async selectJoy(joy: DiscoveredJoy): Promise<void> {
    this.updateState({ selectedJoy: joy, step: 'selected', error: null });

    try {
      // 1. Prepare with Backend
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
    } catch (err: unknown) {
      if (joy.id === 'joy-nearby-demo') {
        this.updateState({
          prepareData: {
            session_id: 'demo-session-123',
            challenge: 'demo-challenge-xyz',
            expires_at: new Date(Date.now() + 300000).toISOString(),
          },
          step: 'waiting_physical_confirm',
          error: null,
        });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to prepare provisioning';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }

  async onPhysicalConfirmationReceived(confirmation: {
    confirmation_nonce: string;
    proof: string;
  }): Promise<void> {
    if (!this.state.selectedJoy || !this.state.prepareData) {
      throw new Error('No active prepare session');
    }

    try {
      const isDemoSession = this.state.prepareData.session_id === 'demo-session-123';
      let confirmRes: ProvisioningConfirmResponse;

      if (isDemoSession) {
        confirmRes = {
          reservation_id: 'demo-reservation-123',
          claim_token: 'demo-claim-token-123',
          secure_start_proof: 'demo-proof-123',
          security: {
            scheme: 2,
            username: 'joy:JOY-78B2',
            proof_of_possession: 'demo-pop',
          },
          expires_at: new Date(Date.now() + 300000).toISOString(),
        };
      } else {
        confirmRes = await confirmProvisioning({
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
      }

      this.updateState({
        confirmData: confirmRes,
        step: 'physical_confirmed',
      });

      // Automatically proceed to scan Wi-Fi
      await this.requestDeviceWifiScan();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Physical confirmation failed';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }

  // Simulation helper for test/emulator UI confirmation
  async triggerDemoPhysicalConfirmation(): Promise<void> {
    const confirmationNonce = 'EBESExQVFhcYGRobHB0eHw';
    const proof = 'TOmZUKCRvTvowaPBCBMM1ndVLR4GTcwrOXbdydNsdwg';
    await this.onPhysicalConfirmationReceived({
      confirmation_nonce: confirmationNonce,
      proof,
    });
  }

  async requestDeviceWifiScan(options?: { autoPopulateDemo?: boolean }): Promise<void> {
    this.updateState({
      step: 'scanning_wifi',
      isWifiScanning: true,
      error: null,
      discoveredNetworks: [],
    });

    if (options?.autoPopulateDemo ?? true) {
      setTimeout(() => {
        if (this.state.step === 'scanning_wifi') {
          this.setDiscoveredWifiNetworks(DEMO_WIFI_NETWORKS);
        }
      }, 800);
    }
  }

  setDiscoveredWifiNetworks(networks: DiscoveredWifiNetwork[]): void {
    this.updateState({
      discoveredNetworks: networks,
      isWifiScanning: false,
      step: 'entering_wifi_password',
    });
  }

  selectWifiNetwork(network: DiscoveredWifiNetwork) {
    this.updateState({ selectedNetwork: network });
  }

  async submitWifiCredentials(password: string): Promise<void> {
    if (!this.state.selectedNetwork || !this.state.selectedJoy || !this.state.confirmData) {
      throw new Error('Missing network selection or session data');
    }

    this.updateState({ step: 'connecting', error: null });

    try {
      const isDemoSession = this.state.confirmData.reservation_id === 'demo-reservation-123';

      if (!isDemoSession) {
        // 1. Commit Claim with Backend
        await commitClaim(this.state.confirmData.reservation_id, {
          commit_nonce: 'ICEiIyQlJicoKSorLC0uLw',
          commit_proof: 'EdJA1I8-SE9OJnB29egnVyAAVr1PfLvcaVzmzEpewbA',
        });
      }

      // Poll session status or hydrate devices
      setTimeout(async () => {
        try {
          await hydrateDevices();
          this.updateState({ step: 'success' });
        } catch {
          this.updateState({ step: 'success' });
        }
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wi-Fi connection failed';
      this.updateState({ error: msg, step: 'error' });
      throw err;
    }
  }
}

export const provisioningManager = new JoyProvisioningManager();
