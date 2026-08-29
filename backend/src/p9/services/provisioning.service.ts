import crypto from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { withP9Transaction } from "../db/client.js";
import { P9Repositories } from "../db/repositories.js";
import { P9Error } from "../errors.js";
import { isUuid } from "../validation.js";
import {
  deriveSecurity2Pop,
  deriveSecureStartProof,
  verifyPhysicalConfirmProof,
  verifyCommitProof,
  verifyFinalizeProof,
  verifyResetProof,
  encryptSecret,
  decryptSecret,
  sha256Hex,
  randomNonce,
  randomBytes,
} from "../crypto/provisioning-crypto.js";
import type { MobileEventPublisher } from "./chat.service.js";

const PREPARE_TTL_MS = 60_000; // 60 seconds
const RESERVATION_TTL_MS = 300_000; // 5 minutes
const FINALIZE_TTL_MS = 86_400_000; // 24 hours

export interface ProvisioningServiceOptions {
  client: PrismaClient;
  masterKey: Buffer;
  mobileEvents?: MobileEventPublisher | undefined;
}

export class ProvisioningService {
  private readonly client: PrismaClient;
  private readonly repositories: P9Repositories;
  private readonly masterKey: Buffer;
  private readonly mobileEvents: MobileEventPublisher | undefined;
  constructor(options: ProvisioningServiceOptions) {
    this.client = options.client;
    this.repositories = new P9Repositories(options.client);
    this.masterKey = options.masterKey;
    this.mobileEvents = options.mobileEvents;
  }

  async registerHardwareIdentity(input: {
    hardwareId: string;
    provisioningRef: string;
    manufacturingSecret: string | Buffer;
    provisioningRootSecret: string | Buffer;
    hardwareRevision?: string;
    resetEpoch?: number;
  }): Promise<void> {
    const mfgSecretBuf = typeof input.manufacturingSecret === "string"
      ? Buffer.from(input.manufacturingSecret, "utf8")
      : input.manufacturingSecret;
    const rootSecretBuf = typeof input.provisioningRootSecret === "string"
      ? Buffer.from(input.provisioningRootSecret, "utf8")
      : input.provisioningRootSecret;

    const mfgEnc = encryptSecret(
      mfgSecretBuf,
      this.masterKey,
      `joy_hardware_identity:manufacturing_secret:${input.hardwareId}`,
    );
    const rootEnc = encryptSecret(
      rootSecretBuf,
      this.masterKey,
      `joy_hardware_identity:provisioning_root:${input.hardwareId}`,
    );

    await this.repositories.hardwareIdentity.upsert({
      where: { hardwareId: input.hardwareId },
      create: {
        hardwareId: input.hardwareId,
        provisioningRef: input.provisioningRef.toUpperCase(),
        manufacturingSecretCiphertext: mfgEnc.ciphertext,
        manufacturingSecretNonce: mfgEnc.nonce,
        manufacturingSecretTag: mfgEnc.tag,
        manufacturingSecretKeyVersion: 1,
        provisioningRootCiphertext: rootEnc.ciphertext,
        provisioningRootNonce: rootEnc.nonce,
        provisioningRootTag: rootEnc.tag,
        provisioningRootKeyVersion: 1,
        resetEpoch: input.resetEpoch ?? 0,
        hardwareRevision: input.hardwareRevision ?? "revA",
      },
      update: {
        provisioningRef: input.provisioningRef.toUpperCase(),
        manufacturingSecretCiphertext: mfgEnc.ciphertext,
        manufacturingSecretNonce: mfgEnc.nonce,
        manufacturingSecretTag: mfgEnc.tag,
        provisioningRootCiphertext: rootEnc.ciphertext,
        provisioningRootNonce: rootEnc.nonce,
        provisioningRootTag: rootEnc.tag,
        hardwareRevision: input.hardwareRevision ?? "revA",
      },
    });
  }

  async prepare(
    userId: string,
    input: {
      protocol_version?: number;
      hardware_id: string;
      provisioning_ref: string;
      setup_nonce: string;
      reset_epoch: number;
    },
  ): Promise<{ session_id: string; challenge: string; expires_at: string }> {
    const hardware = await this.repositories.hardwareIdentity.findUnique({
      where: { hardwareId: input.hardware_id },
    });

    if (!hardware || hardware.provisioningRef !== input.provisioning_ref.toUpperCase()) {
      throw new P9Error("HARDWARE_NOT_FOUND", 404, "Device hardware identity not found");
    }

    if (input.reset_epoch < hardware.resetEpoch) {
      throw new P9Error("RESET_EPOCH_STALE", 409, "Device reset epoch is stale");
    }

    const challengeBytes = randomBytes(32);
    const challengeBase64url = challengeBytes.toString("base64url");
    const challengeHash = sha256Hex(challengeBase64url);
    const setupNonceHash = sha256Hex(input.setup_nonce);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PREPARE_TTL_MS);

    const session = await this.repositories.deviceProvisioningSession.create({
      data: {
        hardwareId: input.hardware_id,
        userId,
        protocolVersion: input.protocol_version ?? 1,
        setupNonce: input.setup_nonce,
        setupNonceHash,
        preparedChallengeHash: challengeHash,
        resetEpochObserved: input.reset_epoch,
        status: "PREPARED",
        prepareExpiresAt: expiresAt,
      },
    });

    return {
      session_id: session.id,
      challenge: challengeBase64url,
      expires_at: expiresAt.toISOString(),
    };
  }

  async confirm(
    userId: string,
    input: {
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
    },
  ): Promise<{
    reservation_id: string;
    claim_token: string;
    secure_start_proof: string;
    security: {
      scheme: 2;
      username: string;
      proof_of_possession: string;
    };
    expires_at: string;
  }> {
    return withP9Transaction(this.client, async (transaction) => {
      const repos = new P9Repositories(transaction);
      await repos.lockHardwareIdentity(input.confirmation.hardware_id);

      const session = await repos.deviceProvisioningSession.findUnique({
        where: { id: input.session_id },
      });

      const now = new Date();
      if (!session || session.userId !== userId) {
        throw new P9Error("OWNERSHIP_DENIED", 404, "Provisioning session not found");
      }

      if (session.status !== "PREPARED" || session.prepareExpiresAt < now) {
        throw new P9Error("PROVISIONING_SESSION_EXPIRED", 410, "Provisioning session has expired");
      }

      if (session.hardwareId !== input.confirmation.hardware_id) {
        throw new P9Error("INVALID_INPUT", 400, "Hardware ID mismatch");
      }

      // Verify challenge hash
      if (sha256Hex(input.confirmation.challenge) !== session.preparedChallengeHash) {
        throw new P9Error("PHYSICAL_CONFIRM_INVALID", 401, "Challenge mismatch");
      }

      // Verify setup nonce hash
      if (sha256Hex(input.confirmation.setup_nonce) !== session.setupNonceHash) {
        throw new P9Error("PHYSICAL_CONFIRM_INVALID", 401, "Setup nonce mismatch");
      }

      const hardware = await repos.hardwareIdentity.findUnique({
        where: { hardwareId: input.confirmation.hardware_id },
      });

      if (!hardware || hardware.provisioningRef !== input.confirmation.provisioning_ref.toUpperCase()) {
        throw new P9Error("HARDWARE_NOT_FOUND", 404, "Hardware identity not found");
      }

      // Decrypt provisioning root secret
      const rootSecret = decryptSecret(
        {
          ciphertext: hardware.provisioningRootCiphertext,
          nonce: hardware.provisioningRootNonce,
          tag: hardware.provisioningRootTag,
        },
        this.masterKey,
        `joy_hardware_identity:provisioning_root:${hardware.hardwareId}`,
      );

      // Verify physical confirmation proof
      const validProof = verifyPhysicalConfirmProof(rootSecret, {
        hardwareId: hardware.hardwareId,
        provisioningRef: hardware.provisioningRef,
        setupNonce: input.confirmation.setup_nonce,
        resetEpoch: input.confirmation.reset_epoch,
        sessionId: session.id,
        challenge: input.confirmation.challenge,
        confirmationNonce: input.confirmation.confirmation_nonce,
        proof: input.confirmation.proof,
      });

      if (!validProof) {
        throw new P9Error("PHYSICAL_CONFIRM_INVALID", 401, "Invalid physical confirmation proof");
      }

      // Reconcile epoch
      if (input.confirmation.reset_epoch < hardware.resetEpoch) {
        throw new P9Error("RESET_EPOCH_STALE", 409, "Reset epoch is stale");
      }

      if (input.confirmation.reset_epoch > hardware.resetEpoch) {
        // Newer epoch observed -> update hardware epoch and revoke old active binding
        await repos.hardwareIdentity.update({
          where: { hardwareId: hardware.hardwareId },
          data: { resetEpoch: input.confirmation.reset_epoch },
        });

        const activeDevices = await repos.device.findMany({
          where: { hardwareId: hardware.hardwareId, status: "ACTIVE" },
        });

        for (const dev of activeDevices) {
          await repos.device.update({
            where: { id: dev.id },
            data: { status: "REVOKED", revokedAt: now },
          });
          if (this.mobileEvents) {
            this.mobileEvents.sendToUser(dev.userId, {
              event: "device_binding_revoked",
              deviceId: dev.id,
              hardwareId: dev.hardwareId,
              reason: "PHYSICAL_RESET",
            });
          }
        }

        // Cancel older sessions
        await repos.deviceProvisioningSession.updateMany({
          where: {
            hardwareId: hardware.hardwareId,
            id: { not: session.id },
            status: { in: ["PREPARED", "RESERVED"] },
          },
          data: { status: "CANCELLED" },
        });
      }

      // Check competing reservation
      const competingReservation = await repos.deviceProvisioningSession.findFirst({
        where: {
          hardwareId: hardware.hardwareId,
          id: { not: session.id },
          status: { in: ["RESERVED", "COMMITTED"] },
          reservationExpiresAt: { gt: now },
        },
      });

      if (competingReservation) {
        throw new P9Error("DEVICE_RESERVED", 409, "Device is already reserved by another session");
      }

      const reservationId = crypto.randomUUID();
      const claimToken = randomNonce(32);
      const claimTokenHash = sha256Hex(claimToken);
      const confirmationNonceHash = sha256Hex(input.confirmation.confirmation_nonce);
      const reservationExpiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);

      const pop = deriveSecurity2Pop(
        rootSecret,
        hardware.provisioningRef,
        input.confirmation.setup_nonce,
      );

      const secureStartProof = deriveSecureStartProof(rootSecret, {
        hardwareId: hardware.hardwareId,
        provisioningRef: hardware.provisioningRef,
        setupNonce: input.confirmation.setup_nonce,
        resetEpoch: input.confirmation.reset_epoch,
        sessionId: session.id,
        reservationId,
      });

      await repos.deviceProvisioningSession.update({
        where: { id: session.id },
        data: {
          id: reservationId, // Set session id to reservationId or link reservationId
          status: "RESERVED",
          reservationExpiresAt,
          claimTokenHash,
          confirmationNonceHash,
          secureStartIssuedAt: now,
        },
      });

      return {
        reservation_id: reservationId,
        claim_token: claimToken,
        secure_start_proof: secureStartProof,
        security: {
          scheme: 2 as const,
          username: `joy:${hardware.provisioningRef}`,
          proof_of_possession: pop,
        },
        expires_at: reservationExpiresAt.toISOString(),
      };
    });
  }

  async commit(
    userId: string,
    reservationId: string,
    input: {
      commit_nonce: string;
      commit_proof: string;
    },
  ): Promise<{ status: "COMMITTED"; reservation_id: string }> {
    return withP9Transaction(this.client, async (transaction) => {
      const repos = new P9Repositories(transaction);
      await repos.lockHardwareIdentity(reservationId);

      const session = await repos.deviceProvisioningSession.findUnique({
        where: { id: reservationId },
      });

      const now = new Date();
      if (!session || session.userId !== userId) {
        throw new P9Error("OWNERSHIP_DENIED", 404, "Reservation not found");
      }

      if (session.status === "COMMITTED") {
        return { status: "COMMITTED", reservation_id: reservationId };
      }

      if (session.status !== "RESERVED" || !session.reservationExpiresAt || session.reservationExpiresAt < now) {
        throw new P9Error("PROVISIONING_SESSION_EXPIRED", 410, "Reservation expired or invalid");
      }

      const hardware = await repos.hardwareIdentity.findUnique({
        where: { hardwareId: session.hardwareId },
      });

      if (!hardware) {
        throw new P9Error("HARDWARE_NOT_FOUND", 404, "Hardware not found");
      }

      const rootSecret = decryptSecret(
        {
          ciphertext: hardware.provisioningRootCiphertext,
          nonce: hardware.provisioningRootNonce,
          tag: hardware.provisioningRootTag,
        },
        this.masterKey,
        `joy_hardware_identity:provisioning_root:${hardware.hardwareId}`,
      );

      // Verify commit proof
      const validCommit = verifyCommitProof(rootSecret, {
        hardwareId: hardware.hardwareId,
        setupNonce: session.setupNonce,
        resetEpoch: session.resetEpochObserved,
        reservationId,
        commitNonce: input.commit_nonce,
        proof: input.commit_proof,
      });

      if (!validCommit) {
        throw new P9Error("AUTHENTICATION_FAILED", 401, "Invalid commit proof");
      }
      // Also check setup_nonce if stored or pass direct
      const commitNonceHash = sha256Hex(input.commit_nonce);
      const finalizeExpiresAt = new Date(now.getTime() + FINALIZE_TTL_MS);

      await repos.deviceProvisioningSession.update({
        where: { id: reservationId },
        data: {
          status: "COMMITTED",
          commitNonceHash,
          finalizeExpiresAt,
        },
      });

      return { status: "COMMITTED", reservation_id: reservationId };
    });
  }

  async getStatus(
    userId: string,
    sessionId: string,
  ): Promise<{
    status: string;
    hardware_id: string;
    device_id: string | null;
    updated_at: string;
  }> {
    const session = await this.repositories.deviceProvisioningSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new P9Error("OWNERSHIP_DENIED", 404, "Session not found");
    }

    return {
      status: session.status,
      hardware_id: session.hardwareId,
      device_id: session.deviceId,
      updated_at: session.updatedAt.toISOString(),
    };
  }

  async finalize(
    hardwareId: string,
    input: {
      reservation_id: string;
      claim_token: string;
      reset_epoch: number;
      finalize_nonce: string;
      firmware_version: string;
      hardware_revision: string;
      manufacturing_proof: string;
    },
  ): Promise<{
    status: "ok";
    device: { id: string; hardwareId: string; status: string };
    runtime: { device_id: string; device_token: string };
  }> {
    return withP9Transaction(this.client, async (transaction) => {
      const repos = new P9Repositories(transaction);
      await repos.lockHardwareIdentity(hardwareId);

      const hardware = await repos.hardwareIdentity.findUnique({
        where: { hardwareId },
      });

      if (!hardware) {
        throw new P9Error("HARDWARE_NOT_FOUND", 404, "Hardware identity not found");
      }

      if (input.reset_epoch !== hardware.resetEpoch) {
        throw new P9Error("RESET_EPOCH_STALE", 409, "Reset epoch mismatch");
      }

      const mfgSecret = decryptSecret(
        {
          ciphertext: hardware.manufacturingSecretCiphertext,
          nonce: hardware.manufacturingSecretNonce,
          tag: hardware.manufacturingSecretTag,
        },
        this.masterKey,
        `joy_hardware_identity:manufacturing_secret:${hardware.hardwareId}`,
      );

      const validFinalize = verifyFinalizeProof(mfgSecret, {
        hardwareId,
        reservationId: input.reservation_id,
        claimToken: input.claim_token,
        resetEpoch: input.reset_epoch,
        finalizeNonce: input.finalize_nonce,
        firmwareVersion: input.firmware_version,
        hardwareRevision: input.hardware_revision,
        proof: input.manufacturing_proof,
      });

      if (!validFinalize) {
        throw new P9Error("AUTHENTICATION_FAILED", 401, "Invalid manufacturing finalize proof");
      }

      const session = await repos.deviceProvisioningSession.findUnique({
        where: { id: input.reservation_id },
      });

      const now = new Date();
      if (!session || session.hardwareId !== hardwareId) {
        throw new P9Error("OWNERSHIP_DENIED", 404, "Reservation session mismatch");
      }

      if (
        session.status !== "COMMITTED" &&
        session.status !== "FINALIZED_PENDING_RUNTIME_ACK"
      ) {
        throw new P9Error("PROVISIONING_SESSION_EXPIRED", 410, "Session is not committed");
      }

      if (session.finalizeExpiresAt && session.finalizeExpiresAt < now) {
        throw new P9Error("PROVISIONING_SESSION_EXPIRED", 410, "Finalize TTL expired");
      }

      if (sha256Hex(input.claim_token) !== session.claimTokenHash) {
        throw new P9Error("CLAIM_TOKEN_INVALID", 401, "Invalid claim token");
      }

      // Idempotency: If already finalized and pending runtime ACK, return the existing device & decrypted token
      if (
        session.status === "FINALIZED_PENDING_RUNTIME_ACK" &&
        session.deviceId &&
        session.runtimeTokenCiphertext &&
        session.runtimeTokenNonce &&
        session.runtimeTokenTag
      ) {
        const device = await repos.device.findUnique({
          where: { id: session.deviceId },
        });

        if (device && device.status === "ACTIVE") {
          const decryptedRuntimeToken = decryptSecret(
            {
              ciphertext: session.runtimeTokenCiphertext,
              nonce: session.runtimeTokenNonce,
              tag: session.runtimeTokenTag,
            },
            this.masterKey,
            `joy_provisioning_session:runtime_token:${session.id}`,
          );

          return {
            status: "ok",
            device: {
              id: device.id,
              hardwareId: device.hardwareId,
              status: device.status,
            },
            runtime: {
              device_id: device.hardwareId,
              device_token: decryptedRuntimeToken.toString("utf8"),
            },
          };
        }
      }

      // Revoke prior active bindings for this physical hardware
      const previousActive = await repos.device.findMany({
        where: { hardwareId, status: "ACTIVE" },
      });

      for (const prev of previousActive) {
        await repos.device.update({
          where: { id: prev.id },
          data: { status: "REVOKED", revokedAt: now },
        });
        if (this.mobileEvents) {
          this.mobileEvents.sendToUser(prev.userId, {
            event: "device_binding_revoked",
            deviceId: prev.id,
            hardwareId: prev.hardwareId,
            reason: "REBOUND",
          });
        }
      }

      // Determine default device (true if user has no other active devices)
      const userActiveCount = await repos.device.count({
        where: { userId: session.userId, status: "ACTIVE" },
      });
      const isDefault = userActiveCount === 0;

      const runtimeToken = `joy_tok_${randomNonce(32)}`;
      const tokenHash = sha256Hex(runtimeToken);
      const displayName = `Joy ${hardware.provisioningRef.slice(0, 4)}`;

      const device = await repos.device.create({
        data: {
          userId: session.userId,
          hardwareId,
          name: displayName,
          tokenHash,
          status: "ACTIVE",
          bindingResetEpoch: hardware.resetEpoch,
          pairedAt: now,
          settings: {
            create: {
              displayName,
              defaultDevice: isDefault,
            },
          },
        },
      });

      const runtimeTokenEnc = encryptSecret(
        Buffer.from(runtimeToken, "utf8"),
        this.masterKey,
        `joy_provisioning_session:runtime_token:${session.id}`,
      );

      await repos.deviceProvisioningSession.update({
        where: { id: session.id },
        data: {
          status: "FINALIZED_PENDING_RUNTIME_ACK",
          deviceId: device.id,
          runtimeTokenCiphertext: runtimeTokenEnc.ciphertext,
          runtimeTokenNonce: runtimeTokenEnc.nonce,
          runtimeTokenTag: runtimeTokenEnc.tag,
          finalizedAt: now,
        },
      });

      return {
        status: "ok",
        device: {
          id: device.id,
          hardwareId: device.hardwareId,
          status: device.status,
        },
        runtime: {
          device_id: device.hardwareId,
          device_token: runtimeToken,
        },
      };
    });
  }

  async handleDeviceReset(
    hardwareId: string,
    event: {
      reset_type: "PAIRING_RESET" | "FACTORY_RESET";
      previous_reset_epoch: number;
      reset_epoch: number;
      reset_nonce: string;
      reset_proof: string;
    },
  ): Promise<{ event: "device_reset_ack"; reset_epoch: number }> {
    return withP9Transaction(this.client, async (transaction) => {
      const repos = new P9Repositories(transaction);
      await repos.lockHardwareIdentity(hardwareId);

      const hardware = await repos.hardwareIdentity.findUnique({
        where: { hardwareId },
      });

      if (!hardware) {
        throw new P9Error("HARDWARE_NOT_FOUND", 404, "Hardware identity not found");
      }

      if (event.previous_reset_epoch !== hardware.resetEpoch) {
        throw new P9Error("RESET_EPOCH_STALE", 409, "Previous reset epoch mismatch");
      }

      if (event.reset_epoch !== hardware.resetEpoch + 1) {
        throw new P9Error("INVALID_INPUT", 400, "Reset epoch must increment exactly by 1");
      }

      const rootSecret = decryptSecret(
        {
          ciphertext: hardware.provisioningRootCiphertext,
          nonce: hardware.provisioningRootNonce,
          tag: hardware.provisioningRootTag,
        },
        this.masterKey,
        `joy_hardware_identity:provisioning_root:${hardware.hardwareId}`,
      );

      const validReset = verifyResetProof(rootSecret, {
        hardwareId,
        provisioningRef: hardware.provisioningRef,
        previousResetEpoch: event.previous_reset_epoch,
        resetEpoch: event.reset_epoch,
        resetType: event.reset_type,
        resetNonce: event.reset_nonce,
        proof: event.reset_proof,
      });

      if (!validReset) {
        throw new P9Error("AUTHENTICATION_FAILED", 401, "Invalid reset proof");
      }

      const now = new Date();
      await repos.hardwareIdentity.update({
        where: { hardwareId },
        data: { resetEpoch: event.reset_epoch },
      });

      const activeDevices = await repos.device.findMany({
        where: { hardwareId, status: "ACTIVE" },
      });

      for (const dev of activeDevices) {
        await repos.device.update({
          where: { id: dev.id },
          data: { status: "REVOKED", revokedAt: now },
        });

        if (this.mobileEvents) {
          this.mobileEvents.sendToUser(dev.userId, {
            event: "device_binding_revoked",
            deviceId: dev.id,
            hardwareId: dev.hardwareId,
            reason: "PHYSICAL_RESET",
          });
        }
      }

      await repos.deviceProvisioningSession.updateMany({
        where: {
          hardwareId,
          status: { in: ["PREPARED", "RESERVED", "COMMITTED"] },
        },
        data: { status: "CANCELLED" },
      });

      return {
        event: "device_reset_ack",
        reset_epoch: event.reset_epoch,
      };
    });
  }

  async completeSessionOnRuntimeAuth(hardwareId: string, deviceId: string): Promise<void> {
    await this.repositories.deviceProvisioningSession.updateMany({
      where: {
        hardwareId,
        deviceId,
        status: "FINALIZED_PENDING_RUNTIME_ACK",
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        runtimeTokenCiphertext: null,
        runtimeTokenNonce: null,
        runtimeTokenTag: null,
      },
    });
  }
}
