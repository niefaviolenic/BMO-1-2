import { describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({
  $executeRaw: vi.fn().mockResolvedValue(0),
  device: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  },
  hardwareEnrollment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  session: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  devicePairing: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  deviceSettings: { update: vi.fn().mockResolvedValue(undefined) },
  auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../src/p9/db/client.js", () => ({
  withP9Transaction: async (_client: unknown, callback: (db: typeof fakeDb) => Promise<unknown>) => callback(fakeDb),
}));

import { DeviceService } from "../../src/p9/services/device.service.js";

describe("P9 device ownership lifecycle", () => {
  it("allows claiming multiple active physical Joy devices for the same user", async () => {
    const repositories = {
      lockUser: vi.fn().mockResolvedValue(undefined),
      device: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: "device-2", status: "ACTIVE" }),
      },
    };

    const result = await new DeviceService({} as never, repositories as never).createClaimed({
      userId: "user-1",
      hardwareId: "joy-002",
      name: "Joy",
      tokenHash: "token-hash",
    });
    expect(result.id).toBe("device-2");
    expect(repositories.device.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        hardwareId: "joy-002",
        status: "ACTIVE",
        settings: {
          create: {
            displayName: "Joy",
            defaultDevice: false,
          },
        },
      }),
    });
  });

  it("clears a revoked default before promoting the replacement", async () => {
    fakeDb.device.findFirst
      .mockResolvedValueOnce({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "user-1",
        hardwareId: "joy-001",
        tokenHash: "token-hash-1",
        status: "ACTIVE",
        settings: { defaultDevice: true },
      })
      .mockResolvedValueOnce({ id: "00000000-0000-0000-0000-000000000002", userId: "user-1", status: "ACTIVE" });

    await new DeviceService({} as never, {} as never).unpair("user-1", "00000000-0000-0000-0000-000000000001", "request-1");

    expect(fakeDb.deviceSettings.update).toHaveBeenCalledWith({
      where: { deviceId: "00000000-0000-0000-0000-000000000001" },
      data: { defaultDevice: false },
    });
    expect(fakeDb.deviceSettings.update).toHaveBeenCalledWith({
      where: { deviceId: "00000000-0000-0000-0000-000000000002" },
      data: { defaultDevice: true },
    });
    expect(fakeDb.hardwareEnrollment.updateMany).toHaveBeenCalledWith({
      where: { hardwareId: "joy-001", status: "ISSUED" },
      data: { status: "INVALIDATED" },
    });
  });

  it("notifies onUnpaired handler with hardware details upon unpair", async () => {
    fakeDb.device.findFirst
      .mockResolvedValueOnce({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "user-1",
        hardwareId: "joy-001",
        tokenHash: "token-hash-1",
        status: "ACTIVE",
        settings: null,
      });

    const onUnpaired = vi.fn().mockResolvedValue(undefined);
    await new DeviceService({} as never, {} as never, onUnpaired).unpair(
      "user-1",
      "00000000-0000-0000-0000-000000000001",
      "request-2",
    );

    expect(onUnpaired).toHaveBeenCalledWith({
      hardwareId: "joy-001",
      tokenHash: "token-hash-1",
      deviceId: "00000000-0000-0000-0000-000000000001",
      userId: "user-1",
    });
  });
});
