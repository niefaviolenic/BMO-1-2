import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { ProvisioningService } from "../../src/p9/services/provisioning.service.js";
import {
  deriveSecurity2Pop,
  deriveSecureStartProof,
  canonicalHmac,
  sha256Hex,
} from "../../src/p9/crypto/provisioning-crypto.js";

describe("ProvisioningService Unit Tests", () => {
  const masterKey = Buffer.alloc(32, 0x42);
  const hardwareId = "joy_11111111-2222-4333-8444-555555555555";
  const provisioningRef = "A7F2K9M3";
  const mfgSecret = Buffer.alloc(32, 0x01);
  const rootSecret = Buffer.alloc(32, 0x02);
  const userId = "00000000-0000-0000-0000-000000000001";

  let db: any;
  let service: ProvisioningService;
  let mobileEventsMock: any;

  beforeEach(() => {
    const hardwareMap = new Map<string, any>();
    const sessionMap = new Map<string, any>();
    const deviceMap = new Map<string, any>();

    mobileEventsMock = {
      send: vi.fn(),
      sendToUser: vi.fn(),
    };

    db = {
      $transaction: async (fn: any) => fn(db),
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([{ now: new Date() }]),
      hardwareIdentity: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          return hardwareMap.get(where.hardwareId) || null;
        }),
        upsert: vi.fn().mockImplementation(async ({ create, update, where }: any) => {
          const existing = hardwareMap.get(where.hardwareId);
          const data = existing ? { ...existing, ...update } : { ...create };
          hardwareMap.set(where.hardwareId, data);
          return data;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const existing = hardwareMap.get(where.hardwareId);
          const updated = { ...existing, ...data };
          hardwareMap.set(where.hardwareId, updated);
          return updated;
        }),
      },
      deviceProvisioningSession: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const session = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
          sessionMap.set(session.id, session);
          return session;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          const res = sessionMap.get(where.id);
          if (!res) {
            console.log("findUnique miss! where:", where, "keys:", Array.from(sessionMap.keys()));
          }
          return res || null;
        }),
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          for (const s of sessionMap.values()) {
            if (where.hardwareId && s.hardwareId !== where.hardwareId) continue;
            if (where.id?.not && s.id === where.id.not) continue;
            if (where.status?.in && !where.status.in.includes(s.status)) continue;
            return s;
          }
          return null;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const existing = sessionMap.get(where.id);
          const newId = data.id || where.id;
          const updated = { ...existing, ...data, id: newId, updatedAt: new Date() };
          if (newId !== where.id) {
            sessionMap.delete(where.id);
          }
          sessionMap.set(newId, updated);
          return updated;
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
          let count = 0;
          for (const [id, s] of sessionMap.entries()) {
            if (where.hardwareId && s.hardwareId !== where.hardwareId) continue;
            if (where.id?.not && s.id === where.id.not) continue;
            if (where.status?.in && !where.status.in.includes(s.status)) continue;
            sessionMap.set(id, { ...s, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        }),
      },
      device: {
        count: vi.fn().mockImplementation(async ({ where }: any) => {
          let c = 0;
          for (const d of deviceMap.values()) {
            if (where.userId && d.userId !== where.userId) continue;
            if (where.status && d.status !== where.status) continue;
            c++;
          }
          return c;
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const dev = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
          deviceMap.set(dev.id, dev);
          return dev;
        }),
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          const list = [];
          for (const d of deviceMap.values()) {
            if (where.hardwareId && d.hardwareId !== where.hardwareId) continue;
            if (where.status && d.status !== where.status) continue;
            list.push(d);
          }
          return list;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          return deviceMap.get(where.id) || null;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const existing = deviceMap.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          deviceMap.set(where.id, updated);
          return updated;
        }),
      },
    };

    service = new ProvisioningService({
      client: db,
      masterKey,
      mobileEvents: mobileEventsMock,
    });
  });

  it("registers hardware identity and executes full lifecycle", async () => {
    // 1. Register Hardware Identity
    await service.registerHardwareIdentity({
      hardwareId,
      provisioningRef,
      manufacturingSecret: mfgSecret,
      provisioningRootSecret: rootSecret,
      hardwareRevision: "revA",
      resetEpoch: 0,
    });

    const setupNonce = "NONCE12345";
    // 2. Prepare
    const prep = await service.prepare(userId, {
      protocol_version: 1,
      hardware_id: hardwareId,
      provisioning_ref: provisioningRef,
      setup_nonce: setupNonce,
      reset_epoch: 0,
    });

    expect(prep.session_id).toBeDefined();
    expect(prep.challenge).toBeDefined();

    // 3. Confirm
    const confirmationNonce = "CONFIRMNONCE";
    const physicalProof = canonicalHmac(rootSecret, [
      "joy-physical-confirm-v1",
      hardwareId,
      provisioningRef,
      setupNonce,
      "0",
      prep.session_id,
      prep.challenge,
      confirmationNonce,
    ]);

    const confirmRes = await service.confirm(userId, {
      session_id: prep.session_id,
      confirmation: {
        hardware_id: hardwareId,
        provisioning_ref: provisioningRef,
        setup_nonce: setupNonce,
        reset_epoch: 0,
        challenge: prep.challenge,
        confirmation_nonce: confirmationNonce,
        proof: physicalProof,
      },
    });

    expect(confirmRes.reservation_id).toBeDefined();
    expect(confirmRes.claim_token).toBeDefined();
    expect(confirmRes.security.username).toBe(`joy:${provisioningRef}`);
    expect(confirmRes.security.proof_of_possession).toBe(deriveSecurity2Pop(rootSecret, provisioningRef, setupNonce));

    // 4. Commit
    const commitNonce = "COMMITNONCE";
    const commitProof = canonicalHmac(rootSecret, [
      "joy-claim-commit-v1",
      hardwareId,
      setupNonce,
      "0",
      confirmRes.reservation_id,
      commitNonce,
    ]);

    const commitRes = await service.commit(userId, confirmRes.reservation_id, {
      commit_nonce: commitNonce,
      commit_proof: commitProof,
    });
    expect(commitRes.status).toBe("COMMITTED");

    // 5. Status
    const status = await service.getStatus(userId, confirmRes.reservation_id);
    expect(status.status).toBe("COMMITTED");
    expect(status.hardware_id).toBe(hardwareId);

    // 6. Finalize (from ESP)
    const finalizeNonce = "FINALIZENONCE";
    const claimSha256 = sha256Hex(confirmRes.claim_token);
    const mfgProof = canonicalHmac(mfgSecret, [
      "joy-device-finalize-v1",
      hardwareId,
      confirmRes.reservation_id,
      claimSha256,
      "0",
      finalizeNonce,
      "v4.0.0",
      "revA",
    ]);

    const finalizeRes = await service.finalize(hardwareId, {
      reservation_id: confirmRes.reservation_id,
      claim_token: confirmRes.claim_token,
      reset_epoch: 0,
      finalize_nonce: finalizeNonce,
      firmware_version: "v4.0.0",
      hardware_revision: "revA",
      manufacturing_proof: mfgProof,
    });

    expect(finalizeRes.status).toBe("ok");
    expect(finalizeRes.device.hardwareId).toBe(hardwareId);
    expect(finalizeRes.device.status).toBe("ACTIVE");
    expect(finalizeRes.runtime.device_token).toMatch(/^joy_tok_/);

    // 7. Idempotent finalize retry returns same device and token
    const retryRes = await service.finalize(hardwareId, {
      reservation_id: confirmRes.reservation_id,
      claim_token: confirmRes.claim_token,
      reset_epoch: 0,
      finalize_nonce: finalizeNonce,
      firmware_version: "v4.0.0",
      hardware_revision: "revA",
      manufacturing_proof: mfgProof,
    });

    expect(retryRes.device.id).toBe(finalizeRes.device.id);
    expect(retryRes.runtime.device_token).toBe(finalizeRes.runtime.device_token);

    // 8. Device reset via WebSocket
    const resetNonce = "RESETNONCE";
    const resetProof = canonicalHmac(rootSecret, [
      "joy-device-reset-v1",
      hardwareId,
      provisioningRef,
      "0",
      "1",
      "PAIRING_RESET",
      resetNonce,
    ]);

    const resetRes = await service.handleDeviceReset(hardwareId, {
      reset_type: "PAIRING_RESET",
      previous_reset_epoch: 0,
      reset_epoch: 1,
      reset_nonce: resetNonce,
      reset_proof: resetProof,
    });

    expect(resetRes.event).toBe("device_reset_ack");
    expect(resetRes.reset_epoch).toBe(1);
    expect(mobileEventsMock.send).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        event: "device_binding_revoked",
        hardwareId,
        reason: "PHYSICAL_RESET",
      }),
    );
  });
});
