import type { PrismaClient } from "../generated/prisma/client.js";

export interface CreateDeliveringAttemptInput {
  userId: string;
  deviceId: string;
  scheduleRunId: string;
  assistantMessageId: string;
  deliveryId: string;
  attemptId: string;
  status: "DELIVERING";
  attemptStatus: "PENDING";
  bindingHardwareId: string;
  ownerKind: any;
  ownerCorrelationId: string;
  generation: number;
  leaseId: string;
  receipt: string;
  leaseExpiresAt: Date;
}

export class ProactiveDeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createDeliveringAttempt(input: CreateDeliveringAttemptInput) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.proactiveDelivery.create({
        data: {
          id: input.deliveryId,
          userId: input.userId,
          deviceId: input.deviceId,
          source: "SCHEDULE",
          sourceResourceType: "ScheduleRun",
          sourceResourceId: input.scheduleRunId,
          idempotencyKey: `schedule:${input.scheduleRunId}:${input.deliveryId}`,
          status: "DELIVERING",
          expiresAt: input.leaseExpiresAt,
        },
      });

      const attempt = await tx.deliveryAttempt.create({
        data: {
          id: input.attemptId,
          deliveryId: delivery.id,
          userId: input.userId,
          deviceId: input.deviceId,
          attemptNumber: 1,
          status: "PENDING",
          channel: "WEBSOCKET",
          bindingHardwareId: input.bindingHardwareId,
          ownerKind: input.ownerKind,
          ownerCorrelationId: input.ownerCorrelationId,
          generation: input.generation,
          leaseId: input.leaseId,
          receipt: input.receipt,
          leaseExpiresAt: input.leaseExpiresAt,
        },
      });

      return { delivery, attempt };
    });
  }

  async markAttemptSent(attemptId: string, audioReceipt: string) {
    return this.prisma.deliveryAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        audioReceipt,
      },
    });
  }

  async markAttemptPlayed(attemptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.deliveryAttempt.update({
        where: { id: attemptId },
        data: {
          status: "PLAYED",
          playedAt: new Date(),
        },
      });

      const delivery = await tx.proactiveDelivery.update({
        where: { id: attempt.deliveryId },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });

      return { delivery, attempt };
    });
  }

  async markAttemptFailed(attemptId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.deliveryAttempt.update({
        where: { id: attemptId },
        data: {
          status: "FAILED",
          errorCode: reason,
        },
      });

      const delivery = await tx.proactiveDelivery.update({
        where: { id: attempt.deliveryId },
        data: {
          status: "FAILED",
          errorCode: reason,
        },
      });

      return { delivery, attempt };
    });
  }
}
