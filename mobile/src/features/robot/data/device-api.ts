import { apiRequest } from '@/lib/api';

import type { SafeDevice } from '../domain/robot-connection';

type DeviceResponse = {
  device: SafeDevice;
};

type DeviceListResponse = {
  devices: SafeDevice[];
};

export type DeviceTelemetry = {
  wifiConnected: boolean | null;
  batterySupported: boolean | null;
  batteryPercent: number | null;
  observedAt: string | null;
};

export type DeviceWifi = {
  ssid: string | null;
  status: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDevice(value: unknown): SafeDevice {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Invalid device payload');
  }

  return {
    id: value.id,
    hardwareId: typeof value.hardwareId === 'string' ? value.hardwareId : '',
    name: typeof value.name === 'string' ? value.name : 'Joy Robot',
    status: typeof value.status === 'string' ? value.status : 'ACTIVE',
    pairedAt: asString(value.pairedAt),
    lastSeenAt: asString(value.lastSeenAt),
  };
}

function asTelemetry(value: unknown): DeviceTelemetry {
  if (!isRecord(value)) {
    return {
      wifiConnected: null,
      batterySupported: null,
      batteryPercent: null,
      observedAt: null,
    };
  }

  return {
    wifiConnected: asBoolean(value.wifiConnected),
    batterySupported: asBoolean(value.batterySupported),
    batteryPercent: asInt(value.batteryPercent),
    observedAt: asString(value.observedAt) ?? asString(value.updatedAt),
  };
}

function asWifi(value: unknown): DeviceWifi | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ssid: asString(value.ssid),
    status: asString(value.status),
  };
}

export async function claimDevice(code: string): Promise<SafeDevice> {
  const payload = await apiRequest<DeviceResponse>('/pairing/claim', {
    method: 'POST',
    body: { code },
  });
  return asDevice(payload.device);
}

export async function listDevices(): Promise<SafeDevice[]> {
  const payload = await apiRequest<DeviceListResponse>('/devices');
  return (payload.devices ?? []).map(asDevice);
}

export async function getDevice(deviceId: string): Promise<SafeDevice> {
  const payload = await apiRequest<DeviceResponse>(`/devices/${deviceId}`);
  return asDevice(payload.device);
}

export async function unpairDevice(deviceId: string): Promise<void> {
  await apiRequest<void>(`/devices/${deviceId}/unpair`, {
    method: 'POST',
  });
}

export async function getDeviceTelemetry(deviceId: string): Promise<DeviceTelemetry> {
  const payload = await apiRequest<{ telemetry: unknown }>(`/devices/${deviceId}/telemetry`);
  return asTelemetry(payload.telemetry);
}

export async function getDeviceWifi(deviceId: string): Promise<DeviceWifi | null> {
  const payload = await apiRequest<{ wifi: unknown }>(`/devices/${deviceId}/wifi`);
  return asWifi(payload.wifi);
}

export type ProvisioningPrepareInput = {
  protocol_version?: number;
  hardware_id: string;
  provisioning_ref: string;
  setup_nonce: string;
  reset_epoch: number;
};

export type ProvisioningPrepareResponse = {
  session_id: string;
  challenge: string;
  expires_at: string;
};

export type ProvisioningConfirmInput = {
  session_id: string;
  confirmation: {
    hardware_id: string;
    provisioning_ref: string;
    setup_nonce: string;
    reset_epoch: number;
    challenge: string;
    confirmation_nonce: string;
    proof: string;
  };
};

export type ProvisioningConfirmResponse = {
  reservation_id: string;
  claim_token: string;
  secure_start_proof: string;
  security: {
    scheme: 2;
    username: string;
    proof_of_possession: string;
  };
  expires_at: string;
};

export type ClaimCommitInput = {
  commit_nonce: string;
  commit_proof: string;
};

export type ClaimCommitResponse = {
  status: 'COMMITTED';
  reservation_id: string;
};

export type ProvisioningSessionStatusResponse = {
  status: string;
  hardware_id: string;
  device_id: string | null;
  updated_at: string;
};

export async function prepareProvisioning(input: ProvisioningPrepareInput): Promise<ProvisioningPrepareResponse> {
  return apiRequest<ProvisioningPrepareResponse>('/devices/provisioning/prepare', {
    method: 'POST',
    body: input,
  });
}

export async function confirmProvisioning(input: ProvisioningConfirmInput): Promise<ProvisioningConfirmResponse> {
  return apiRequest<ProvisioningConfirmResponse>('/devices/provisioning/confirm', {
    method: 'POST',
    body: input,
  });
}

export async function commitClaim(reservationId: string, input: ClaimCommitInput): Promise<ClaimCommitResponse> {
  return apiRequest<ClaimCommitResponse>(`/devices/claim-reservations/${reservationId}/commit`, {
    method: 'POST',
    body: input,
  });
}

export async function getProvisioningStatus(sessionId: string): Promise<ProvisioningSessionStatusResponse> {
  return apiRequest<ProvisioningSessionStatusResponse>(`/devices/provisioning-sessions/${sessionId}`, {
    method: 'GET',
  });
}
