import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { randomUUID } from "node:crypto";

import { RequestStore } from "../src/domain/request-store.js";
import { DeviceRegistry } from "../src/websocket/device-registry.js";
import { DeviceWebSocketServer } from "../src/websocket/websocket.server.js";
import type { ApplicationDeviceBinding } from "../src/p9/services/device-binding.service.js";

interface TestRuntime {
  httpServer: Server;
  requestStore: RequestStore;
  registry: DeviceRegistry;
  socketServer: DeviceWebSocketServer;
  url: string;
}

const runtimes: TestRuntime[] = [];

async function startRuntime(options: {
  resolveApplicationDevice?: (
    deviceId: string,
    deviceToken: string,
  ) => Promise<ApplicationDeviceBinding | null>;
  authorizeApplicationDevice?: (binding: ApplicationDeviceBinding) => Promise<boolean>;
} = {}) {
  const httpServer = createServer();
  const requestStore = new RequestStore();
  const registry = new DeviceRegistry(requestStore);
  const socketServer = new DeviceWebSocketServer({
    httpServer,
    registry,
    deviceId: "joy-001",
    deviceToken: "test-device-secret",
    authTimeoutMs: 500,
    heartbeatIntervalMs: 5_000,
    maxMissedPongs: 2,
    maxMessageBytes: 8_192,
    ...(options.resolveApplicationDevice !== undefined ? {
      resolveApplicationDevice: options.resolveApplicationDevice,
    } : {}),
    ...(options.authorizeApplicationDevice !== undefined ? {
      authorizeApplicationDevice: options.authorizeApplicationDevice,
    } : {}),
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  const runtime: TestRuntime = {
    httpServer,
    requestStore,
    registry,
    socketServer,
    url: `ws://127.0.0.1:${address.port}/ws`,
  };
  runtimes.push(runtime);
  return runtime;
}

afterEach(async () => {
  while (runtimes.length > 0) {
    const runtime = runtimes.pop()!;
    await runtime.socketServer.close();
    await new Promise<void>((resolve) => runtime.httpServer.close(() => resolve()));
  }
});

describe("DeviceWebSocketServer & DeviceRegistry ID Resolution", () => {
  it("resolves online and idle status when queried by database UUID or hardware ID", async () => {
    const databaseDeviceId = randomUUID();
    const userId = randomUUID();
    const hardwareId = "joy-001";

    const binding: ApplicationDeviceBinding = {
      deviceId: databaseDeviceId,
      userId,
      hardwareId,
    };

    const runtime = await startRuntime({
      resolveApplicationDevice: async (dId, token) => {
        if (dId === hardwareId && token === "test-device-secret") return binding;
        return null;
      },
      authorizeApplicationDevice: async () => true,
    });

    // Before connection
    const offlineBefore = runtime.socketServer.isDeviceOnlineAndIdle(databaseDeviceId);
    expect(offlineBefore.online).toBe(false);
    expect(offlineBefore.idle).toBe(false);

    // Connect and authenticate hardware device
    const ws = new WebSocket(runtime.url);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    ws.send(JSON.stringify({
      event: "authenticate",
      device_id: hardwareId,
      device_token: "test-device-secret",
    }));

    // Wait for authenticated response
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.event === "authenticated") resolve();
      });
      ws.on("error", reject);
    });

    // Allow background resolveApplicationBinding task to complete
    await new Promise((r) => setTimeout(r, 50));

    // 1. Query by database UUID
    const statusByDbUuid = runtime.socketServer.isDeviceOnlineAndIdle(databaseDeviceId);
    expect(statusByDbUuid.online).toBe(true);
    expect(statusByDbUuid.idle).toBe(true);
    expect(statusByDbUuid.hardwareId).toBe("joy-001");

    // 2. Query by hardware ID
    const statusByHwId = runtime.socketServer.isDeviceOnlineAndIdle(hardwareId);
    expect(statusByHwId.online).toBe(true);
    expect(statusByHwId.idle).toBe(true);
    expect(statusByHwId.hardwareId).toBe("joy-001");

    // 3. Query non-existent device
    const statusUnknown = runtime.socketServer.isDeviceOnlineAndIdle(randomUUID());
    expect(statusUnknown.online).toBe(false);
    expect(statusUnknown.idle).toBe(false);

    // 4. Busy state when active request exists
    const requestId = randomUUID();
    runtime.requestStore.create({
      requestId,
      deviceId: hardwareId,
      inputPath: "/tmp/in.wav",
      inputSha256: "abc",
      inputContentLength: 100,
    });

    const statusBusyByDbUuid = runtime.socketServer.isDeviceOnlineAndIdle(databaseDeviceId);
    expect(statusBusyByDbUuid.online).toBe(true);
    expect(statusBusyByDbUuid.idle).toBe(false);
    expect(statusBusyByDbUuid.hardwareId).toBe("joy-001");

    // Close socket
    ws.close();
    await new Promise((r) => setTimeout(r, 50));

    const statusAfterClose = runtime.socketServer.isDeviceOnlineAndIdle(databaseDeviceId);
    expect(statusAfterClose.online).toBe(false);
    expect(statusAfterClose.idle).toBe(false);
  });
});
