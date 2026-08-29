import { randomBytes, randomUUID } from "node:crypto";
import type {
  Prisma,
  DeviceSpeechOwnerKind,
  DeviceSpeechReservation,
} from "../../generated/prisma/client.js";

export type { DeviceSpeechOwnerKind, DeviceSpeechReservation };

export interface AuthenticatedDeviceResolver {
  resolveP9DeviceId(hardwareBinding: string): Promise<string>;
}

export type DeviceSpeechAcquireMode =
  | "ACQUIRE_OR_RETURN_EXACT"
  | "MATCH_ACTIVE_LEASE";

export interface AcquireInput {
  mode: DeviceSpeechAcquireMode;
  ownerKind: DeviceSpeechOwnerKind;
  ownerCorrelationId: string;
  leaseDurationMs?: number | null;
  leaseId?: string | null;
  receipt?: string | null;
}

export interface PromoteInput {
  fromOwnerKind: DeviceSpeechOwnerKind;
  toOwnerKind: DeviceSpeechOwnerKind;
  ownerCorrelationId: string;
  generation: number;
  leaseId: string | null;
  receipt: string | null;
  nextLeaseId: string | null;
  nextReceipt: string | null;
  nextLeaseDurationMs: number | null;
}

export interface ReleaseInput {
  ownerKind: DeviceSpeechOwnerKind;
  ownerCorrelationId: string;
  generation: number;
  leaseId: string | null;
  receipt: string | null;
}

export interface DeviceSpeechArbiterStore {
  acquire(
    tx: Prisma.TransactionClient,
    input: { deviceId: string } & AcquireInput,
  ): Promise<DeviceSpeechReservation | null>;
  promote(
    tx: Prisma.TransactionClient,
    input: { deviceId: string } & PromoteInput,
  ): Promise<boolean>;
  release(
    tx: Prisma.TransactionClient,
    input: { deviceId: string } & ReleaseInput,
  ): Promise<boolean>;
}

export interface DeviceSpeechTransactionRunner {
  run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export class DeviceSpeechArbiterService {
  constructor(
    private readonly resolver: AuthenticatedDeviceResolver,
    private readonly store: DeviceSpeechArbiterStore,
    private readonly transactions: DeviceSpeechTransactionRunner,
  ) {}

  async runInTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.transactions.run(work);
  }

  async acquire(
    hardwareBinding: string,
    input: AcquireInput,
    existingTx?: Prisma.TransactionClient,
  ): Promise<DeviceSpeechReservation | null> {
    const deviceId = await this.resolver.resolveP9DeviceId(hardwareBinding);
    const doAcquire = async (tx: Prisma.TransactionClient) => {
      return this.store.acquire(tx, { deviceId, ...input });
    };

    if (existingTx) {
      return doAcquire(existingTx);
    }
    return this.transactions.run(doAcquire);
  }

  async promote(
    hardwareBinding: string,
    input: PromoteInput,
    existingTx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const deviceId = await this.resolver.resolveP9DeviceId(hardwareBinding);
    const doPromote = async (tx: Prisma.TransactionClient) => {
      return this.store.promote(tx, { deviceId, ...input });
    };

    if (existingTx) {
      return doPromote(existingTx);
    }
    return this.transactions.run(doPromote);
  }

  async release(
    hardwareBinding: string,
    input: ReleaseInput,
    existingTx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const deviceId = await this.resolver.resolveP9DeviceId(hardwareBinding);
    const doRelease = async (tx: Prisma.TransactionClient) => {
      return this.store.release(tx, { deviceId, ...input });
    };

    if (existingTx) {
      return doRelease(existingTx);
    }
    return this.transactions.run(doRelease);
  }
}

export class PrismaDeviceSpeechArbiterStore implements DeviceSpeechArbiterStore {
  async acquire(
    tx: Prisma.TransactionClient,
    input: { deviceId: string } & AcquireInput,
  ): Promise<DeviceSpeechReservation | null> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.deviceId}::text, 0))`;

    const rows = await tx.$queryRaw<DeviceSpeechReservation[]>`
      SELECT "id", "deviceId", "ownerKind", "ownerCorrelationId", "generation",
             "leaseId", "receipt", "leaseExpiresAt", "createdAt", "updatedAt"
      FROM "DeviceSpeechReservation"
      WHERE "deviceId" = ${input.deviceId}::uuid
      FOR UPDATE
    `;
    const existing = rows[0] ?? null;
    const now = new Date();

    if (input.mode === "MATCH_ACTIVE_LEASE") {
      if (
        existing &&
        existing.leaseExpiresAt &&
        existing.leaseExpiresAt > now &&
        existing.ownerKind === input.ownerKind &&
        existing.ownerCorrelationId === input.ownerCorrelationId &&
        existing.leaseId === input.leaseId &&
        existing.receipt === input.receipt
      ) {
        return existing;
      }
      return null;
    }

    // mode === "ACQUIRE_OR_RETURN_EXACT"
    if (existing && existing.leaseExpiresAt && existing.leaseExpiresAt > now) {
      if (
        existing.ownerKind === input.ownerKind &&
        existing.ownerCorrelationId === input.ownerCorrelationId
      ) {
        return existing;
      }
      return null;
    }

    const nextGen = existing ? existing.generation + 1 : 1;
    const leaseId = input.leaseDurationMs ? randomUUID() : null;
    const receipt = input.leaseDurationMs
      ? randomBytes(32).toString("base64url")
      : null;
    const leaseExpiresAt = input.leaseDurationMs
      ? new Date(now.getTime() + input.leaseDurationMs)
      : null;

    const upserted = await tx.$queryRaw<DeviceSpeechReservation[]>`
      INSERT INTO "DeviceSpeechReservation" (
        "id", "deviceId", "ownerKind", "ownerCorrelationId", "generation",
        "leaseId", "receipt", "leaseExpiresAt", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        ${input.deviceId}::uuid,
        ${input.ownerKind}::"DeviceSpeechOwnerKind",
        ${input.ownerCorrelationId}::uuid,
        ${nextGen},
        ${leaseId}::uuid,
        ${receipt},
        ${leaseExpiresAt},
        now(),
        now()
      )
      ON CONFLICT ("deviceId") DO UPDATE SET
        "ownerKind" = EXCLUDED."ownerKind",
        "ownerCorrelationId" = EXCLUDED."ownerCorrelationId",
        "generation" = EXCLUDED."generation",
        "leaseId" = EXCLUDED."leaseId",
        "receipt" = EXCLUDED."receipt",
        "leaseExpiresAt" = EXCLUDED."leaseExpiresAt",
        "updatedAt" = now()
      RETURNING "id", "deviceId", "ownerKind", "ownerCorrelationId", "generation",
                "leaseId", "receipt", "leaseExpiresAt", "createdAt", "updatedAt"
    `;

    return upserted[0] ?? null;
  }

  async promote(
    tx: Prisma.TransactionClient,
    input: { deviceId: string } & PromoteInput,
  ): Promise<boolean> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.deviceId}::text, 0))`;

    const now = new Date();
    const nextExpiresAt = input.nextLeaseDurationMs
      ? new Date(now.getTime() + input.nextLeaseDurationMs)
      : null;

    const result = await tx.$queryRaw<{ deviceId: string }[]>`
      UPDATE "DeviceSpeechReservation"
      SET
        "ownerKind" = ${input.toOwnerKind}::"DeviceSpeechOwnerKind",
        "leaseId" = ${input.nextLeaseId}::uuid,
        "receipt" = ${input.nextReceipt},
        "leaseExpiresAt" = ${nextExpiresAt},
        "updatedAt" = now()
      WHERE "deviceId" = ${input.deviceId}::uuid
        AND "ownerKind" = ${input.fromOwnerKind}::"DeviceSpeechOwnerKind"
        AND "ownerCorrelationId" = ${input.ownerCorrelationId}::uuid
        AND "generation" = ${input.generation}
        AND "leaseId" IS NOT DISTINCT FROM ${input.leaseId}::uuid
        AND "receipt" IS NOT DISTINCT FROM ${input.receipt}
      RETURNING "deviceId"
    `;

    return result.length > 0;
  }

  async release(
    tx: Prisma.TransactionClient,
    input: { deviceId: string } & ReleaseInput,
  ): Promise<boolean> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.deviceId}::text, 0))`;

    const result = await tx.$queryRaw<{ deviceId: string }[]>`
      DELETE FROM "DeviceSpeechReservation"
      WHERE "deviceId" = ${input.deviceId}::uuid
        AND "ownerKind" = ${input.ownerKind}::"DeviceSpeechOwnerKind"
        AND "ownerCorrelationId" = ${input.ownerCorrelationId}::uuid
        AND "generation" = ${input.generation}
        AND "leaseId" IS NOT DISTINCT FROM ${input.leaseId}::uuid
        AND "receipt" IS NOT DISTINCT FROM ${input.receipt}
      RETURNING "deviceId"
    `;

    return result.length > 0;
  }
}
