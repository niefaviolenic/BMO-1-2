const fs = require('fs');
const path = '/opt/joy/app/backend/prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

// 1. Add enums if not present
if (!schema.includes('enum DeviceSpeechOwnerKind')) {
  const enumsToAdd = `
enum DeviceSpeechOwnerKind {
  VOICE_CAPTURE_RESERVED
  VOICE_PROCESSING
  PROACTIVE_DELIVERY
}

enum ChatSessionPurpose {
  USER_CHAT
  JOY_SCHEDULE
}
`;
  schema = schema.replace('enum DeliveryAttemptStatus {', enumsToAdd + '\nenum DeliveryAttemptStatus {');
}

// 2. Add speechReservation to Device model
if (!schema.includes('speechReservation   DeviceSpeechReservation?')) {
  schema = schema.replace(
    '  telemetryCurrent    DeviceTelemetryCurrent?',
    '  telemetryCurrent    DeviceTelemetryCurrent?\n  speechReservation   DeviceSpeechReservation?'
  );
}

// 3. Add purpose to ChatSession
if (!schema.includes('purpose           ChatSessionPurpose')) {
  schema = schema.replace(
    '  status            ChatSessionStatus @default(ACTIVE)',
    '  purpose           ChatSessionPurpose @default(USER_CHAT)\n  status            ChatSessionStatus @default(ACTIVE)'
  );
}

// 4. Add scheduleRunId & scheduleRun to ChatMessage
if (!schema.includes('scheduleRunId    String?')) {
  schema = schema.replace(
    '  sourceDeviceId   String?               @db.Uuid',
    '  sourceDeviceId   String?               @db.Uuid\n  scheduleRunId    String?               @unique @db.Uuid'
  );
  schema = schema.replace(
    '  sourceDevice     Device?               @relation("ChatMessageSourceDevice", fields: [sourceDeviceId, userId], references: [id, userId], onDelete: SetNull)',
    '  sourceDevice     Device?               @relation("ChatMessageSourceDevice", fields: [sourceDeviceId, userId], references: [id, userId], onDelete: SetNull)\n  scheduleRun      ScheduleRun?          @relation("ScheduleRunResultMessage", fields: [scheduleRunId], references: [id], onDelete: SetNull)'
  );
}

// 5. Add resultMessage to ScheduleRun
if (!schema.includes('resultMessage    ChatMessage?')) {
  schema = schema.replace(
    '  schedule       Schedule          @relation(fields: [scheduleId], references: [id], onDelete: Cascade)',
    '  schedule       Schedule          @relation(fields: [scheduleId], references: [id], onDelete: Cascade)\n  resultMessage  ChatMessage?      @relation("ScheduleRunResultMessage")'
  );
}

// 6. Add speechOwner fields to DeliveryAttempt
if (!schema.includes('bindingHardwareId String?')) {
  schema = schema.replace(
    '  errorDetail   String?               @db.VarChar(500)',
    '  errorDetail        String?               @db.VarChar(500)\n  bindingHardwareId  String?               @db.VarChar(128)\n  ownerKind          DeviceSpeechOwnerKind?\n  ownerCorrelationId String?               @db.Uuid\n  generation         Int?\n  leaseId            String?               @db.Uuid\n  receipt            String?               @db.VarChar(512)\n  leaseExpiresAt     DateTime?             @db.Timestamptz(3)\n  audioReceipt       String?               @db.VarChar(512)'
  );
}

// 7. Add DeviceSpeechReservation model
if (!schema.includes('model DeviceSpeechReservation')) {
  const modelToAdd = `
model DeviceSpeechReservation {
  id                 String                @id @default(uuid()) @db.Uuid
  deviceId           String                @unique @db.Uuid
  ownerKind          DeviceSpeechOwnerKind
  ownerCorrelationId String                @db.Uuid
  generation         Int                   @default(1)
  leaseId            String?               @db.Uuid
  receipt            String?               @db.VarChar(512)
  leaseExpiresAt     DateTime?             @db.Timestamptz(3)
  createdAt          DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime              @updatedAt @db.Timestamptz(3)
  device             Device                @relation(fields: [deviceId], references: [id], onDelete: Cascade)
}
`;
  schema += modelToAdd;
}

fs.writeFileSync(path, schema, 'utf8');
console.log('Schema updated successfully');
