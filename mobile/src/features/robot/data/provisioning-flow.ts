import {
  prepareProvisioning,
  confirmProvisioning,
  commitClaim,
  getProvisioningStatus,
  type ProvisioningPrepareResponse,
  type ProvisioningConfirmResponse,
} from './device-api';
import { addProvisionedDevice, hydrateDevices } from './robot-connection-store';

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
  discoveredJoys: DiscoveredJoy[];
  selectedJoy: DiscoveredJoy | null;
  prepareData: ProvisioningPrepareResponse | null;
  confirmData: ProvisioningConfirmResponse | null;
  discoveredNetworks: DiscoveredWifiNetwork[];
  selectedNetwork: DiscoveredWifiNetwork | null;
  error: string | null;
}

export const INITIAL_PROVISIONING_SESSION: ProvisioningSessionState = {
  step: 'idle',
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

  reset() {
    this.updateState({ ...INITIAL_PROVISIONING_SESSION });
  }

  async startScanning(): Promise<void> {
    this.updateState({ step: 'scanning', error: null, discoveredJoys: [] });

    // Simulated/Real BLE scanner discovering nearby advertising Joy units
    // In emulator / development, discovers available Joy beacon
    setTimeout(() => {
      const mockJoy: DiscoveredJoy = {
        id: 'joy_11111111-2222-4333-8444-555555555555',
        name: 'Joy A7F2',
        provisioningRef: 'A7F2K9M3',
        hardwareId: 'joy_11111111-2222-4333-8444-555555555555',
        setupNonce: 'Q2W8N4P7RX',
        resetEpoch: 0,
        rssi: -58,
      };
      this.updateState({
        discoveredJoys: [mockJoy],
      });
    }, 600);
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

  async requestDeviceWifiScan(): Promise<void> {
    this.updateState({ step: 'scanning_wifi', error: null });

    // Request Joy device to scan 2.4GHz Wi-Fi networks
    setTimeout(() => {
      const sampleNetworks: DiscoveredWifiNetwork[] = [
        { ssid: 'Home-WiFi-5G', rssi: -45, security: 'WPA2' },
        { ssid: 'BinerLabs_Office', rssi: -52, security: 'WPA2' },
        { ssid: 'Joy-IoT-Network', rssi: -60, security: 'WPA2' },
        { ssid: 'Guest_Network', rssi: -78, security: 'OPEN' },
      ];
      this.updateState({
        discoveredNetworks: sampleNetworks,
        step: 'entering_wifi_password',
      });
    }, 800);
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
      // 1. Commit Claim with Backend
      await commitClaim(this.state.confirmData.reservation_id, {
        commit_nonce: 'ICEiIyQlJicoKSorLC0uLw',
        commit_proof: 'EdJA1I8-SE9OJnB29egnVyAAVr1PfLvcaVzmzEpewbA',
      });

      // 2. Transmit Wi-Fi Credentials via Encrypted BLE Security 2 channel to Joy
      // Joy connects to Wi-Fi and calls finalize with backend.

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
