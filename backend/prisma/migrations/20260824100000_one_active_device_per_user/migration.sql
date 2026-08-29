-- A user may retain revoked hardware history, but only one physical Joy may
-- be active at a time.
CREATE UNIQUE INDEX "Device_user_active_key"
  ON "Device"("userId")
  WHERE "status" = 'ACTIVE';
