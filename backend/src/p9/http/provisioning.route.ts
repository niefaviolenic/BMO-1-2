import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { ProvisioningService } from "../services/provisioning.service.js";
import { DeviceService } from "../services/device.service.js";
import {
  parseProvisioningPrepare,
  parseProvisioningConfirm,
  parseClaimCommit,
  parseDeviceFinalize,
} from "../validation.js";
import { asyncP9, currentAuth, requireAuth, requestContext } from "./middleware.js";
import type { AccessTokenService, SessionService } from "../services/session.service.js";
import type { P9Config } from "../config.js";
import { P9Error } from "../errors.js";

export function createProvisioningRouter(
  provisioning: ProvisioningService,
  devices: DeviceService,
  accessTokens: AccessTokenService,
  sessions: SessionService,
  config: P9Config,
): Router {
  const router = Router();
  const authenticated = requireAuth(accessTokens, sessions);

  const prepareLimiter = rateLimit({
    windowMs: 600_000, // 10 minutes
    limit: 10,
    keyGenerator: (request) => request.p9Auth?.userId ?? ipKeyGenerator(request.ip ?? "unknown-user"),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ error: "RATE_LIMITED" }),
  });

  const finalizeLimiter = rateLimit({
    windowMs: 600_000, // 10 minutes
    limit: 12,
    keyGenerator: (request) => request.get("X-Hardware-Id") ?? ipKeyGenerator(request.ip ?? "unknown-hw"),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ error: "RATE_LIMITED" }),
  });

  router.post(
    "/devices/provisioning/prepare",
    authenticated,
    prepareLimiter,
    asyncP9(async (request, response) => {
      const auth = currentAuth(request);
      const input = parseProvisioningPrepare(request.body);
      const result = await provisioning.prepare(auth.userId, input);
      response.status(201).json(result);
    }),
  );

  router.post(
    "/devices/provisioning/confirm",
    authenticated,
    prepareLimiter,
    asyncP9(async (request, response) => {
      const auth = currentAuth(request);
      const input = parseProvisioningConfirm(request.body);
      const result = await provisioning.confirm(auth.userId, input);
      response.status(200).json(result);
    }),
  );

  router.post(
    "/devices/claim-reservations/:reservationId/commit",
    authenticated,
    asyncP9(async (request, response) => {
      const auth = currentAuth(request);
      const rawReservationId = request.params.reservationId;
      const reservationId = typeof rawReservationId === "string" ? rawReservationId : Array.isArray(rawReservationId) ? rawReservationId[0] ?? "" : "";
      const input = parseClaimCommit(request.body);
      const result = await provisioning.commit(auth.userId, reservationId, input);
      response.status(200).json(result);
    }),
  );

  router.get(
    "/devices/provisioning-sessions/:sessionId",
    authenticated,
    asyncP9(async (request, response) => {
      const auth = currentAuth(request);
      const rawSessionId = request.params.sessionId;
      const sessionId = typeof rawSessionId === "string" ? rawSessionId : Array.isArray(rawSessionId) ? rawSessionId[0] ?? "" : "";
      const result = await provisioning.getStatus(auth.userId, sessionId);
      response.status(200).json(result);
    }),
  );

  router.post(
    "/devices/:deviceId/unpair",
    authenticated,
    asyncP9(async (request, response) => {
      const auth = currentAuth(request);
      const context = requestContext(request, response);
      const rawDeviceId = request.params.deviceId;
      const deviceId = typeof rawDeviceId === "string" ? rawDeviceId : Array.isArray(rawDeviceId) ? rawDeviceId[0] ?? "" : "";
      await devices.unpair(auth.userId, deviceId, context.requestId);
      response.status(200).json({ status: "ok" });
    }),
  );

  router.post(
    "/device-enrollment/finalize",
    finalizeLimiter,
    asyncP9(async (request, response) => {
      const hardwareId = request.get("X-Hardware-Id");
      if (!hardwareId) {
        throw new P9Error("INVALID_INPUT", 400, "Missing X-Hardware-Id header");
      }
      const input = parseDeviceFinalize(request.body);
      const result = await provisioning.finalize(hardwareId, input);
      response.status(200).json(result);
    }),
  );

  return router;
}
