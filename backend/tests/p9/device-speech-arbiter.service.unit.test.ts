import { describe, expect, test, vi, type Mocked } from "vitest";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { randomUUID } from "node:crypto";
import {
  DeviceSpeechArbiterService,
  type AuthenticatedDeviceResolver,
  type DeviceSpeechArbiterStore,
  type DeviceSpeechTransactionRunner,
} from "../../src/p9/services/device-speech-arbiter.service.js";

const deviceId = randomUUID();
const bindingId = "authenticated-binding:device-cert-sha256";
const correlationId = randomUUID();

function fixture() {
  const resolver: AuthenticatedDeviceResolver = {
    resolveP9DeviceId: vi.fn(async (binding) => {
      if (binding !== bindingId) throw new Error("unknown binding");
      return deviceId;
    }),
  };
  const store: Mocked<DeviceSpeechArbiterStore> = {
    acquire: vi.fn(),
    promote: vi.fn(),
    release: vi.fn(),
  };
  const tx = {} as Prisma.TransactionClient;
  const transactions: DeviceSpeechTransactionRunner = {
    run: vi.fn(async (work) => work(tx)),
  };
  const service = new DeviceSpeechArbiterService(
    resolver,
    store,
    transactions,
  );
  return { resolver, store, service, tx };
}

describe("DeviceSpeechArbiterService", () => {
  test("resolves the authenticated hardware binding to the P9 Device UUID", async () => {
    const { resolver, store, service, tx } = fixture();
    store.acquire.mockResolvedValue({
      id: randomUUID(),
      deviceId,
      ownerKind: "VOICE_CAPTURE_RESERVED",
      ownerCorrelationId: correlationId,
      generation: 1,
      leaseId: randomUUID(),
      receipt: "opaque-receipt",
      leaseExpiresAt: new Date("2026-08-25T12:00:45.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.acquire(bindingId, {
      mode: "ACQUIRE_OR_RETURN_EXACT",
      ownerKind: "VOICE_CAPTURE_RESERVED",
      ownerCorrelationId: correlationId,
      leaseDurationMs: 45_000,
    });

    expect(resolver.resolveP9DeviceId).toHaveBeenCalledWith(bindingId);
    expect(store.acquire).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ deviceId }),
    );
    expect(store.acquire).not.toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ deviceId: "joy-001" }),
    );
  });

  test("promotes only the exact reserved tuple without reacquiring", async () => {
    const { store, service, tx } = fixture();
    const leaseId = randomUUID();
    store.promote.mockResolvedValue(true);

    await expect(
      service.promote(bindingId, {
        fromOwnerKind: "VOICE_CAPTURE_RESERVED",
        toOwnerKind: "VOICE_PROCESSING",
        ownerCorrelationId: correlationId,
        generation: 7,
        leaseId,
        receipt: "reserve-receipt",
        nextLeaseId: null,
        nextReceipt: null,
        nextLeaseDurationMs: null,
      }),
    ).resolves.toBe(true);

    expect(store.promote).toHaveBeenCalledWith(tx, {
      deviceId,
      fromOwnerKind: "VOICE_CAPTURE_RESERVED",
      toOwnerKind: "VOICE_PROCESSING",
      ownerCorrelationId: correlationId,
      generation: 7,
      leaseId,
      receipt: "reserve-receipt",
      nextLeaseId: null,
      nextReceipt: null,
      nextLeaseDurationMs: null,
    });
    expect(store.release).not.toHaveBeenCalled();
    expect(store.acquire).not.toHaveBeenCalled();
  });

  test("releases only an exact owner tuple", async () => {
    const { store, service, tx } = fixture();
    const leaseId = randomUUID();
    store.release.mockResolvedValue(false);

    await expect(
      service.release(bindingId, {
        ownerKind: "PROACTIVE_DELIVERY",
        ownerCorrelationId: correlationId,
        generation: 4,
        leaseId,
        receipt: "audio-receipt",
      }),
    ).resolves.toBe(false);

    expect(store.release).toHaveBeenCalledWith(tx, {
      deviceId,
      ownerKind: "PROACTIVE_DELIVERY",
      ownerCorrelationId: correlationId,
      generation: 4,
      leaseId,
      receipt: "audio-receipt",
    });
  });
});
