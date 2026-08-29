-- CreateEnum
CREATE TYPE "DeviceSpeechOwnerKind" AS ENUM ('VOICE_CAPTURE_RESERVED', 'VOICE_PROCESSING', 'PROACTIVE_DELIVERY');

-- CreateEnum
CREATE TYPE "ChatSessionPurpose" AS ENUM ('USER_CHAT', 'JOY_SCHEDULE');

-- AlterTable ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "purpose" "ChatSessionPurpose" NOT NULL DEFAULT 'USER_CHAT';

-- AlterTable ChatMessage
ALTER TABLE "ChatMessage" ADD COLUMN "scheduleRunId" UUID;
CREATE UNIQUE INDEX "ChatMessage_scheduleRunId_key" ON "ChatMessage"("scheduleRunId");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_scheduleRunId_fkey" FOREIGN KEY ("scheduleRunId") REFERENCES "ScheduleRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable DeviceSpeechReservation
CREATE TABLE "DeviceSpeechReservation" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "ownerKind" "DeviceSpeechOwnerKind" NOT NULL,
    "ownerCorrelationId" UUID NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "leaseId" UUID,
    "receipt" VARCHAR(512),
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DeviceSpeechReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSpeechReservation_deviceId_key" ON "DeviceSpeechReservation"("deviceId");

-- AddForeignKey
ALTER TABLE "DeviceSpeechReservation" ADD CONSTRAINT "DeviceSpeechReservation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable DeliveryAttempt
ALTER TABLE "DeliveryAttempt" ADD COLUMN "bindingHardwareId" VARCHAR(128);
ALTER TABLE "DeliveryAttempt" ADD COLUMN "ownerKind" "DeviceSpeechOwnerKind";
ALTER TABLE "DeliveryAttempt" ADD COLUMN "ownerCorrelationId" UUID;
ALTER TABLE "DeliveryAttempt" ADD COLUMN "generation" INTEGER;
ALTER TABLE "DeliveryAttempt" ADD COLUMN "leaseId" UUID;
ALTER TABLE "DeliveryAttempt" ADD COLUMN "receipt" VARCHAR(512);
ALTER TABLE "DeliveryAttempt" ADD COLUMN "leaseExpiresAt" TIMESTAMPTZ(3);
ALTER TABLE "DeliveryAttempt" ADD COLUMN "audioReceipt" VARCHAR(512);
