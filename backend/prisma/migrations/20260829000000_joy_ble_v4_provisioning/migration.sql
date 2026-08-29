-- Drop the one active Joy per user constraint (v4 supports multiple active devices per user)
DROP INDEX IF EXISTS "Device_user_active_key";

-- Ensure one active binding per physical hardware
CREATE UNIQUE INDEX IF NOT EXISTS "Device_active_hardware_key"
  ON "Device"("hardwareId")
  WHERE "status" = 'ACTIVE';

-- Add bindingResetEpoch to Device
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "bindingResetEpoch" INTEGER NOT NULL DEFAULT 0;

-- Create ProvisioningSessionStatus enum
DO $$ BEGIN
  CREATE TYPE "ProvisioningSessionStatus" AS ENUM (
    'PREPARED',
    'RESERVED',
    'COMMITTED',
    'FINALIZED_PENDING_RUNTIME_ACK',
    'COMPLETED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create HardwareIdentity table
CREATE TABLE IF NOT EXISTS "HardwareIdentity" (
  "hardwareId" VARCHAR(128) NOT NULL,
  "provisioningRef" VARCHAR(8) NOT NULL,
  "manufacturingSecretCiphertext" TEXT NOT NULL,
  "manufacturingSecretNonce" VARCHAR(64) NOT NULL,
  "manufacturingSecretTag" VARCHAR(64) NOT NULL,
  "manufacturingSecretKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "provisioningRootCiphertext" TEXT NOT NULL,
  "provisioningRootNonce" VARCHAR(64) NOT NULL,
  "provisioningRootTag" VARCHAR(64) NOT NULL,
  "provisioningRootKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "resetEpoch" INTEGER NOT NULL DEFAULT 0,
  "hardwareRevision" VARCHAR(32) NOT NULL DEFAULT 'revA',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HardwareIdentity_pkey" PRIMARY KEY ("hardwareId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HardwareIdentity_provisioningRef_key"
  ON "HardwareIdentity"("provisioningRef");

-- Create DeviceProvisioningSession table
CREATE TABLE IF NOT EXISTS "DeviceProvisioningSession" (
  "id" UUID NOT NULL,
  "hardwareId" VARCHAR(128) NOT NULL,
  "userId" UUID NOT NULL,
  "protocolVersion" INTEGER NOT NULL DEFAULT 1,
  "setupNonce" VARCHAR(128) NOT NULL DEFAULT '',
  "setupNonceHash" CHAR(64) NOT NULL,
  "preparedChallengeHash" CHAR(64) NOT NULL,
  "resetEpochObserved" INTEGER NOT NULL,
  "status" "ProvisioningSessionStatus" NOT NULL DEFAULT 'PREPARED',
  "prepareExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "reservationExpiresAt" TIMESTAMPTZ(3),
  "finalizeExpiresAt" TIMESTAMPTZ(3),
  "claimTokenHash" CHAR(64),
  "confirmationNonceHash" CHAR(64),
  "commitNonceHash" CHAR(64),
  "secureStartIssuedAt" TIMESTAMPTZ(3),
  "runtimeTokenCiphertext" TEXT,
  "runtimeTokenNonce" VARCHAR(64),
  "runtimeTokenTag" VARCHAR(64),
  "deviceId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  CONSTRAINT "DeviceProvisioningSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceProvisioningSession_hardwareId_fkey" FOREIGN KEY ("hardwareId") REFERENCES "HardwareIdentity"("hardwareId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceProvisioningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeviceProvisioningSession_hardwareId_status_idx"
  ON "DeviceProvisioningSession"("hardwareId", "status");

CREATE INDEX IF NOT EXISTS "DeviceProvisioningSession_userId_status_idx"
  ON "DeviceProvisioningSession"("userId", "status");
