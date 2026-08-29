import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createProvisioningRouter } from "../../src/p9/http/provisioning.route.js";
import { p9ErrorHandler } from "../../src/p9/http/middleware.js";

function fixture() {
  const provisioning = {
    prepare: vi.fn().mockResolvedValue({
      session_id: "00000000-0000-0000-0000-000000000010",
      challenge: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
      expires_at: "2026-08-29T12:01:00.000Z",
    }),
    confirm: vi.fn().mockResolvedValue({
      reservation_id: "00000000-0000-0000-0000-000000000020",
      claim_token: "claim-token-123",
      secure_start_proof: "secure-start-proof-123",
      security: {
        scheme: 2,
        username: "joy:A7F2K9M3",
        proof_of_possession: "pop-123",
      },
      expires_at: "2026-08-29T12:05:00.000Z",
    }),
    commit: vi.fn().mockResolvedValue({
      status: "COMMITTED",
      reservation_id: "00000000-0000-0000-0000-000000000020",
    }),
    getStatus: vi.fn().mockResolvedValue({
      status: "COMMITTED",
      hardware_id: "joy_11111111-2222-4333-8444-555555555555",
      device_id: null,
      updated_at: "2026-08-29T12:02:00.000Z",
    }),
    finalize: vi.fn().mockResolvedValue({
      status: "ok",
      device: {
        id: "00000000-0000-0000-0000-000000000030",
        hardwareId: "joy_11111111-2222-4333-8444-555555555555",
        status: "ACTIVE",
      },
      runtime: {
        device_id: "joy_11111111-2222-4333-8444-555555555555",
        device_token: "joy_tok_test_123",
      },
    }),
  };

  const devices = {
    unpair: vi.fn().mockResolvedValue(undefined),
  };

  const accessTokens = {
    verify: vi.fn().mockResolvedValue({ sub: "user-1", sid: "session-1" }),
  };
  const sessions = { isActive: vi.fn().mockResolvedValue(true) };

  const app = express();
  app.use(express.json());
  app.use(createProvisioningRouter(
    provisioning as never,
    devices as never,
    accessTokens as never,
    sessions as never,
    {} as never,
  ));
  app.use(p9ErrorHandler);

  return { app, provisioning, devices, accessTokens };
}

describe("Provisioning HTTP Routes", () => {
  it("handles POST /devices/provisioning/prepare", async () => {
    const f = fixture();
    await request(f.app)
      .post("/devices/provisioning/prepare")
      .set("Authorization", "Bearer access-token")
      .send({
        protocol_version: 1,
        hardware_id: "joy_11111111-2222-4333-8444-555555555555",
        provisioning_ref: "a7f2k9m3",
        setup_nonce: "NONCE123",
        reset_epoch: 0,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.session_id).toBe("00000000-0000-0000-0000-000000000010");
        expect(body.challenge).toBeDefined();
      });

    expect(f.provisioning.prepare).toHaveBeenCalledWith("user-1", {
      protocol_version: 1,
      hardware_id: "joy_11111111-2222-4333-8444-555555555555",
      provisioning_ref: "A7F2K9M3",
      setup_nonce: "NONCE123",
      reset_epoch: 0,
    });
  });

  it("handles POST /devices/provisioning/confirm", async () => {
    const f = fixture();
    await request(f.app)
      .post("/devices/provisioning/confirm")
      .set("Authorization", "Bearer access-token")
      .send({
        session_id: "00000000-0000-0000-0000-000000000010",
        confirmation: {
          hardware_id: "joy_11111111-2222-4333-8444-555555555555",
          provisioning_ref: "a7f2k9m3",
          setup_nonce: "NONCE123",
          reset_epoch: 0,
          challenge: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
          confirmation_nonce: "CONFIRMNONCE",
          proof: "proof-123",
        },
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.reservation_id).toBe("00000000-0000-0000-0000-000000000020");
        expect(body.security.scheme).toBe(2);
      });

    expect(f.provisioning.confirm).toHaveBeenCalledWith("user-1", expect.any(Object));
  });

  it("handles POST /devices/claim-reservations/:reservationId/commit", async () => {
    const f = fixture();
    await request(f.app)
      .post("/devices/claim-reservations/00000000-0000-0000-0000-000000000020/commit")
      .set("Authorization", "Bearer access-token")
      .send({
        commit_nonce: "COMMITNONCE",
        commit_proof: "commit-proof-123",
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("COMMITTED");
      });

    expect(f.provisioning.commit).toHaveBeenCalledWith(
      "user-1",
      "00000000-0000-0000-0000-000000000020",
      {
        commit_nonce: "COMMITNONCE",
        commit_proof: "commit-proof-123",
      },
    );
  });

  it("handles GET /devices/provisioning-sessions/:sessionId", async () => {
    const f = fixture();
    await request(f.app)
      .get("/devices/provisioning-sessions/00000000-0000-0000-0000-000000000010")
      .set("Authorization", "Bearer access-token")
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("COMMITTED");
        expect(body.hardware_id).toBe("joy_11111111-2222-4333-8444-555555555555");
      });

    expect(f.provisioning.getStatus).toHaveBeenCalledWith(
      "user-1",
      "00000000-0000-0000-0000-000000000010",
    );
  });

  it("handles POST /api/v1/device-enrollment/finalize", async () => {
    const f = fixture();
    await request(f.app)
      .post("/device-enrollment/finalize")
      .set("X-Hardware-Id", "joy_11111111-2222-4333-8444-555555555555")
      .send({
        reservation_id: "00000000-0000-0000-0000-000000000020",
        claim_token: "claim-token-123",
        reset_epoch: 0,
        finalize_nonce: "FINALIZENONCE",
        firmware_version: "v4.0.0",
        hardware_revision: "revA",
        manufacturing_proof: "mfg-proof-123",
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("ok");
        expect(body.device.status).toBe("ACTIVE");
        expect(body.runtime.device_token).toBe("joy_tok_test_123");
      });

    expect(f.provisioning.finalize).toHaveBeenCalledWith(
      "joy_11111111-2222-4333-8444-555555555555",
      expect.objectContaining({
        reservation_id: "00000000-0000-0000-0000-000000000020",
        claim_token: "claim-token-123",
      }),
    );
  });

  it("handles POST /devices/:deviceId/unpair", async () => {
    const f = fixture();
    await request(f.app)
      .post("/devices/00000000-0000-0000-0000-000000000030/unpair")
      .set("Authorization", "Bearer access-token")
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("ok");
      });

    expect(f.devices.unpair).toHaveBeenCalledWith(
      "user-1",
      "00000000-0000-0000-0000-000000000030",
      expect.any(String),
    );
  });
});
