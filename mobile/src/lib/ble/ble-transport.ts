import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export const JOY_SVC_UUID = '0000fe01-6a6f-7961-692d-62696e657231';
export const CHR_IDENTITY_UUID = '0000fe02-6a6f-7961-692d-62696e657231';
export const CHR_CHALLENGE_UUID = '0000fe03-6a6f-7961-692d-62696e657231';
export const CHR_PROOF_UUID = '0000fe04-6a6f-7961-692d-62696e657231';
export const CHR_SECURE_START_UUID = '0000fe05-6a6f-7961-692d-62696e657231';
export const CHR_COMMIT_UUID = '0000fe06-6a6f-7961-692d-62696e657231';
export const CHR_WIFI_SCAN_UUID = '0000fe07-6a6f-7961-692d-62696e657231';
export interface DiscoveredBleDevice {
  id: string;
  name: string;
  rssi: number;
}

const BLE_UNSUPPORTED_ERROR =
  'Bluetooth (BLE) membutuhkan development build native dan tidak didukung di Expo Go standar.';

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const apiLevel =
      typeof Platform.Version === 'string' ? parseInt(Platform.Version, 10) : Platform.Version;

    if (apiLevel >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[BLE] Permission request error:', err);
    return false;
  }
}

export class BleTransportClient {
  private manager: BleManager | null = null;
  private managerInitAttempted = false;
  private connectedDevice: Device | null = null;
  private negotiatedMtu = 23;
  private messageSeq = 1;

  getNegotiatedMtu(): number {
    return this.negotiatedMtu;
  }

  setNegotiatedMtu(mtu: number): void {
    this.negotiatedMtu = Math.max(23, mtu);
  }

  private getManager(): BleManager | null {
    if (!this.manager && !this.managerInitAttempted) {
      this.managerInitAttempted = true;
      try {
        this.manager = new BleManager();
      } catch (err) {
        console.warn(
          '[BLE] BleManager initialization failed (likely running in Expo Go where NativeModules.BleClient is null):',
          err
        );
        this.manager = null;
      }
    }
    return this.manager;
  }
  async startScan(onDiscovered: (device: DiscoveredBleDevice) => void): Promise<void> {
    const hasPermission = await requestBlePermissions();
    if (!hasPermission) {
      console.warn('[BLE] Bluetooth permissions not granted');
      return;
    }

    const mgr = this.getManager();
    if (!mgr) {
      console.warn('[BLE] startScan skipped: BleManager is not available in Expo Go.');
      return;
    }
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
    const mgr = this.getManager();
    if (!mgr) return;
    try {
      mgr.stopDeviceScan();
    } catch {
      // Ignore stop scan error
    }
  }

  async connect(deviceId: string): Promise<void> {
    this.stopScan();
    // Give iOS CoreBluetooth a brief moment to teardown scan before GATT connect
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 150);
    await promise;

    const mgr = this.getManager();
    if (!mgr) {
      throw new Error(BLE_UNSUPPORTED_ERROR);
    }
    const device = await mgr.connectToDevice(deviceId);
    const discovered = await device.discoverAllServicesAndCharacteristics();

    // iOS negotiates MTU automatically at OS level; requestMTU is Android-only
    if (Platform.OS === 'android') {
      try {
        const devWithMtu = await discovered.requestMTU(512);
        this.negotiatedMtu = devWithMtu?.mtu ?? 23;
      } catch {
        this.negotiatedMtu = 23;
      }
    } else {
      this.negotiatedMtu = 185;
    }

    this.connectedDevice = discovered;
  }
  async readJson<T>(charUuid: string): Promise<T> {
    if (!this.connectedDevice) {
      if (!this.getManager()) {
        throw new Error(BLE_UNSUPPORTED_ERROR);
      }
      throw new Error('BLE device not connected');
    }
    const char = await this.connectedDevice.readCharacteristicForService(JOY_SVC_UUID, charUuid);
    if (!char.value) throw new Error('Empty characteristic value');
    const jsonStr = Buffer.from(char.value, 'base64').toString('utf8');
    return JSON.parse(jsonStr) as T;
  }

  async writeFramedJson(charUuid: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.connectedDevice) {
      if (!this.getManager()) {
        throw new Error(BLE_UNSUPPORTED_ERROR);
      }
      throw new Error('BLE device not connected');
    }

    const jsonStr = JSON.stringify(payload);
    const payloadBuf = Buffer.from(jsonStr, 'utf8');
    if (payloadBuf.length > 2048) {
      throw new Error('BLE JSON payload exceeds maximum 2048 bytes');
    }

    // 8-byte header: version:u8=1, flags:u8, message_id:u16LE, offset:u16LE, total_bytes:u16LE
    const maxChunkPayload = Math.max(12, (this.negotiatedMtu || 23) - 3 - 8);
    const msgId = (this.messageSeq++) & 0xffff;
    const totalBytes = payloadBuf.length;

    let offset = 0;
    while (offset < totalBytes || (totalBytes === 0 && offset === 0)) {
      const chunkLen = Math.min(maxChunkPayload, totalBytes - offset);
      const isStart = offset === 0;
      const isEnd = offset + chunkLen === totalBytes;
      let flags = 0;
      if (isStart) flags |= 0x01;
      if (isEnd) flags |= 0x02;

      const header = Buffer.alloc(8);
      header.writeUInt8(1, 0);
      header.writeUInt8(flags, 1);
      header.writeUInt16LE(msgId, 2);
      header.writeUInt16LE(offset, 4);
      header.writeUInt16LE(totalBytes, 6);

      const chunkData = totalBytes > 0 ? payloadBuf.subarray(offset, offset + chunkLen) : Buffer.alloc(0);
      const frameBuf = Buffer.concat([header, chunkData]);

      const base64Val = frameBuf.toString('base64');
      await this.connectedDevice.writeCharacteristicWithResponseForService(JOY_SVC_UUID, charUuid, base64Val);

      offset += chunkLen;
      if (totalBytes === 0) break;
    }
  }

  async writeJson(charUuid: string, payload: Record<string, unknown>): Promise<void> {
    await this.writeFramedJson(charUuid, payload);
  }

  monitorJson<T>(charUuid: string, onData: (data: T) => void): () => void {
    if (!this.connectedDevice) {
      if (!this.getManager()) {
        throw new Error(BLE_UNSUPPORTED_ERROR);
      }
      throw new Error('BLE device not connected');
    }
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
    if (!this.connectedDevice) {
      if (!this.getManager()) {
        throw new Error(BLE_UNSUPPORTED_ERROR);
      }
      return;
    }
    try {
      await this.connectedDevice.cancelConnection();
    } catch {
      // Ignore disconnection errors during cleanup
    }
    this.connectedDevice = null;
  }
}

export const bleClient = new BleTransportClient();
