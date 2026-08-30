import { Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export const JOY_SVC_UUID = '0000fe01-6a6f-7961-692d-62696e657231';
export const CHR_IDENTITY_UUID = '0000fe02-6a6f-7961-692d-62696e657231';
export const CHR_CHALLENGE_UUID = '0000fe03-6a6f-7961-692d-62696e657231';
export const CHR_PROOF_UUID = '0000fe04-6a6f-7961-692d-62696e657231';
export const CHR_SECURE_START_UUID = '0000fe05-6a6f-7961-692d-62696e657231';
export const CHR_COMMIT_UUID = '0000fe06-6a6f-7961-692d-62696e657231';

export interface DiscoveredBleDevice {
  id: string;
  name: string;
  rssi: number;
}

export class BleTransportClient {
  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;

  private getManager(): BleManager {
    if (!this.manager) {
      this.manager = new BleManager();
    }
    return this.manager;
  }

  async startScan(onDiscovered: (device: DiscoveredBleDevice) => void): Promise<void> {
    const mgr = this.getManager();
    mgr.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        if (!error.message?.toLowerCase().includes('cancel')) {
          console.warn('[BLE Scan Error]', error);
        }
        return;
      }
      if (!device) return;
      const devName = device.name || device.localName;
      const hasJoySvc = device.serviceUUIDs?.some((uuid) =>
        uuid.toLowerCase().includes('fe01') || uuid.toLowerCase() === JOY_SVC_UUID.toLowerCase()
      );

      if ((devName && (devName.startsWith('JOY-') || devName.toUpperCase().includes('JOY'))) || hasJoySvc) {
        const finalName = devName || (hasJoySvc ? 'JOY-Robot' : 'Joy');
        onDiscovered({
          id: device.id,
          name: finalName,
          rssi: device.rssi ?? -60,
        });
      }
    });
  }

  stopScan(): void {
    if (this.manager) {
      try {
        this.manager.stopDeviceScan();
      } catch {
        // Ignore stop scan error
      }
    }
  }

  async connect(deviceId: string): Promise<void> {
    this.stopScan();
    // Give iOS CoreBluetooth a brief moment to teardown scan before GATT connect
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 150);
    await promise;

    const mgr = this.getManager();
    const device = await mgr.connectToDevice(deviceId);
    const discovered = await device.discoverAllServicesAndCharacteristics();

    // iOS negotiates MTU automatically at OS level; requestMTU is Android-only
    if (Platform.OS === 'android') {
      try {
        await discovered.requestMTU(256);
      } catch {
        // Ignore MTU errors
      }
    }

    this.connectedDevice = discovered;
  }
  async readJson<T>(charUuid: string): Promise<T> {
    if (!this.connectedDevice) throw new Error('BLE device not connected');
    const char = await this.connectedDevice.readCharacteristicForService(JOY_SVC_UUID, charUuid);
    if (!char.value) throw new Error('Empty characteristic value');
    const jsonStr = Buffer.from(char.value, 'base64').toString('utf8');
    return JSON.parse(jsonStr) as T;
  }

  async writeJson(charUuid: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.connectedDevice) throw new Error('BLE device not connected');
    const jsonStr = JSON.stringify(payload);
    const base64Val = Buffer.from(jsonStr, 'utf8').toString('base64');
    await this.connectedDevice.writeCharacteristicWithResponseForService(JOY_SVC_UUID, charUuid, base64Val);
  }

  monitorJson<T>(charUuid: string, onData: (data: T) => void): () => void {
    if (!this.connectedDevice) throw new Error('BLE device not connected');
    const subscription = this.connectedDevice.monitorCharacteristicForService(
      JOY_SVC_UUID,
      charUuid,
      (error, char) => {
        if (error || !char?.value) return;
        try {
          const jsonStr = Buffer.from(char.value, 'base64').toString('utf8');
          onData(JSON.parse(jsonStr) as T);
        } catch {
          // Ignore parse errors on malformed notifications
        }
      }
    );
    return () => subscription.remove();
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch {
        // Ignore disconnection errors during cleanup
      }
      this.connectedDevice = null;
    }
  }
}

export const bleClient = new BleTransportClient();
