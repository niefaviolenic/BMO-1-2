import type WebSocket from "ws";
import type { RequestStore, VoiceRequestRecord } from "../domain/request-store.js";
import type { BackendState } from "./events.js";
import type { ApplicationDeviceBinding } from "../p9/services/device-binding.service.js";

interface DeviceConnection {
  socket: WebSocket;
  authenticatedAt: number;
  lastPongAt: number;
  applicationBinding: ApplicationDeviceBinding | null;
}

export interface DeviceBackendState {
  backendState: BackendState;
  activeRequest: VoiceRequestRecord | null;
}

export class DeviceRegistry {
  readonly #connections = new Map<string, DeviceConnection>();

  constructor(private readonly requestStore: RequestStore) {}

  authenticate(deviceId: string, socket: WebSocket): WebSocket | null {
    const previous = this.#connections.get(deviceId)?.socket ?? null;
    const now = Date.now();
    this.#connections.set(deviceId, {
      socket,
      authenticatedAt: now,
      lastPongAt: now,
      applicationBinding: null,
    });
    return previous === socket ? null : previous;
  }

  remove(deviceId: string, socket: WebSocket): void {
    if (this.#connections.get(deviceId)?.socket === socket) {
      this.#connections.delete(deviceId);
    }
  }

  touchPong(deviceId: string, socket: WebSocket): void {
    const connection = this.#connections.get(deviceId);
    if (connection?.socket === socket) {
      connection.lastPongAt = Date.now();
    }
  }

  getApplicationBinding(deviceId: string): ApplicationDeviceBinding | null {
    return this.getConnectionByAnyId(deviceId)?.applicationBinding ?? null;
  }

  getConnectionByAnyId(idOrHardwareId: string): DeviceConnection | undefined {
    const direct = this.#connections.get(idOrHardwareId);
    if (direct) return direct;
    for (const conn of this.#connections.values()) {
      if (
        conn.applicationBinding?.deviceId === idOrHardwareId ||
        conn.applicationBinding?.hardwareId === idOrHardwareId
      ) {
        return conn;
      }
    }
    return undefined;
  }

  getSocket(deviceId: string): WebSocket | undefined {
    return this.getConnectionByAnyId(deviceId)?.socket;
  }

  setApplicationBinding(
    deviceId: string,
    socket: WebSocket,
    binding: ApplicationDeviceBinding,
  ): boolean {
    const connection = this.#connections.get(deviceId);
    if (connection?.socket !== socket) return false;
    connection.applicationBinding = binding;
    return true;
  }

  clearApplicationBinding(deviceId: string): void {
    const connection = this.getConnectionByAnyId(deviceId);
    if (connection) {
      connection.applicationBinding = null;
    }
  }

  async authorizeApplicationBinding(
    deviceId: string,
    authorize: (binding: ApplicationDeviceBinding) => Promise<boolean>,
  ): Promise<ApplicationDeviceBinding | null> {
    const connection = this.getConnectionByAnyId(deviceId);
    const binding = connection?.applicationBinding;
    if (!connection || !binding) return null;

    let active = false;
    try {
      active = await authorize(binding);
    } catch {
      active = false;
    }

    const current = this.getConnectionByAnyId(deviceId);
    if (current !== connection || current.applicationBinding !== binding) return null;
    if (!active) {
      current.applicationBinding = null;
      return null;
    }
    return binding;
  }

  isAuthenticated(deviceId: string, socket?: WebSocket): boolean {
    const active = this.getConnectionByAnyId(deviceId)?.socket;
    return socket ? active === socket : active !== undefined;
  }

  getBackendState(deviceId: string): DeviceBackendState {
    const hardwareId = this.getConnectionByAnyId(deviceId)?.applicationBinding?.hardwareId ?? deviceId;
    const activeRequest = this.requestStore.getActiveForDevice(hardwareId) ?? null;
    if (!activeRequest) {
      return { backendState: "idle", activeRequest: null };
    }
    return {
      backendState: activeRequest.status === "audio_ready" ? "audio_ready" : "thinking",
      activeRequest,
    };
  }
}
