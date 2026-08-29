import { PushNotificationService } from "./services/push-notification.service.js";
import type { VoiceChatHandler } from "../services/voice-pipeline.service.js";
import type { AudioServicePort } from "../services/audio-service.client.js";
import type { TempAudioService } from "../services/temp-audio.service.js";
import { createP9Client, disconnectP9Client } from "./db/client.js";
import { P9Repositories } from "./db/repositories.js";
import type { P9Config } from "./config.js";
import { AuthService } from "./services/auth.service.js";
import { DeviceService } from "./services/device.service.js";
import { InvitationService } from "./services/invitation.service.js";
import { HardwareEnrollmentService, type HardwareEnrollmentEventSender } from "./services/hardware-enrollment.service.js";
import { AccessTokenService, SessionService } from "./services/session.service.js";
import { SettingsService } from "./services/settings.service.js";
import { UserService } from "./services/user.service.js";
import { DeviceBindingService, type ApplicationDeviceBinding } from "./services/device-binding.service.js";
import { ProvisioningService } from "./services/provisioning.service.js";
import crypto from "node:crypto";
import { createP9Router } from "./http/router.js";
import type { Router } from "express";
import type { Logger } from "pino";
import { areRequiredP9MigrationsFinished } from "./migration-manifest.js";
import { RecoveryService } from "./services/recovery.service.js";
import { ProfileService } from "./services/profile.service.js";
import { PersonalizationService } from "./services/personalization.service.js";
import { AvatarStorage } from "./services/avatar-storage.service.js";
import { AvatarService } from "./services/avatar.service.js";
import type { AvatarReconciliationResult } from "./services/avatar.service.js";
import { createAvatarMediaRouter } from "./http/profile.route.js";
import { authenticateMobileAccessToken } from "./websocket/mobile-auth.js";
import { ChatService, type MobileEventPublisher } from "./services/chat.service.js";
import { PostgresMemoryGateway } from "./services/memory-gateway.service.js";
import { MemoryService } from "./services/memory.service.js";
import { ScheduleService } from "./services/schedule.service.js";
import { ScheduleChatRepository } from "../repositories/schedule-chat.repository.js";
import { ScheduledResultService } from "../services/scheduled-result.service.js";
import { DeviceSpeechArbiterService, PrismaDeviceSpeechArbiterStore } from "./services/device-speech-arbiter.service.js";
import { ProactiveDeliveryRepository } from "../repositories/proactive-delivery.repository.js";
import { OneShotDeviceSpeechPort, type DeviceSocketBridge } from "../device-speech.port.js";

import { ProactiveDeliveryService } from "./services/proactive-delivery.service.js";
import { DeviceAdditionsService } from "./services/device-additions.service.js";
import { decodeWifiEncryptionKey } from "./device-additions.crypto.js";
import { IntegrationService } from "./services/integration.service.js";
import { BugReportService } from "./services/bug-report.service.js";
import type { HermesGenerateClient } from "../services/hermes.client.js";
import { SpotifyApiClient } from "./providers/spotify.client.js";
import { HermesWhatsAppBridgeClient, HermesWhatsAppPairingClient } from "./providers/hermes-whatsapp.client.js";
import { HermesWhatsAppIdentityResolverClient } from "./providers/hermes-whatsapp-identity.client.js";

export interface P9Runtime {
  router: Router;
  mediaRouter: Router;
  initialize(): Promise<void>;
  reconcileAvatars(): Promise<AvatarReconciliationResult>;
  resolveDeviceBinding(hardwareId: string, deviceToken: string): Promise<ApplicationDeviceBinding | null>;
  authorizeDeviceBinding(binding: ApplicationDeviceBinding): Promise<boolean>;
  issueHardwareEnrollment(hardwareId: string, tokenHash: string): ReturnType<HardwareEnrollmentService["issueForHardware"]>;
  setHardwareEventSender(sender: HardwareEnrollmentEventSender): void;
  setDeviceSocketBridge(bridge: DeviceSocketBridge): void;
  authenticateMobileSocket(accessToken: string): Promise<{
    userId: string;
    sessionId: string;
    expiresAt: Date;
  } | { kind: "expired" } | null>;
  checkReadiness(): Promise<boolean>;
  resumePendingChat(): Promise<number>;
  launchPendingChatRecovery(onError?: (error: unknown) => void): void;
  waitForChatIdle(): Promise<void>;
  runScheduler(): Promise<{ materialized: number; claimed: number; pendingPhysical: number }>;
  pollWhatsApp(): Promise<{ processed: number; queued: number }>;
  voiceChatHandler: VoiceChatHandler;
  deviceAdditions: DeviceAdditionsService;
  provisioning: ProvisioningService;
  handleDeviceReset(hardwareId: string, event: { reset_type: "PAIRING_RESET" | "FACTORY_RESET"; previous_reset_epoch: number; reset_epoch: number; reset_nonce: string; reset_proof: string }): Promise<{ event: "device_reset_ack"; reset_epoch: number }>;
  completeSessionOnRuntimeAuth(hardwareId: string, deviceId: string): Promise<void>;
  settings: SettingsService;
  close(): Promise<void>;
}

export interface P9RuntimeOptions {
  includeOps?: boolean | undefined;
  hermes?: HermesGenerateClient | undefined;
  mobileEvents?: MobileEventPublisher | undefined;
  chatHardTimeoutMs?: number | undefined;
  logger?: Logger | undefined;
  audioService?: AudioServicePort | undefined;
  tempAudio?: TempAudioService | undefined;
  publicBaseUrl?: (() => string) | undefined;
}

const unavailableHermes: HermesGenerateClient = {
  async generate(): Promise<string> {
    throw new Error("Hermes client is unavailable");
  },
};

const noMobileEvents: MobileEventPublisher = { sendToUser: () => 0 };

export async function checkP9Readiness(
  repositories: Pick<P9Repositories, "healthCheck" | "migrationStatus">,
): Promise<boolean> {
  try {
    await repositories.healthCheck();
    const migrations = await repositories.migrationStatus();
    return areRequiredP9MigrationsFinished(migrations);
  } catch {
    return false;
  }
}

export function createP9Runtime(config: P9Config, options: P9RuntimeOptions = {}): P9Runtime {
  if (!config.enabled || !config.databaseUrl || !config.jwtSecret || !config.pairingPepper) {
    throw new Error("P9 runtime requires enabled database and security configuration");
  }
  const client = createP9Client(config);
  const repositories = new P9Repositories(client);
  const accessTokens = new AccessTokenService({
    secret: new TextEncoder().encode(config.jwtSecret),
    issuer: "joy-p9",
    audience: "joy-mobile",
    lifetimeSeconds: config.accessTokenTtlSeconds,
  });
  const sessions = new SessionService({ client, repositories, accessTokens, refreshTokenTtlSeconds: config.refreshTokenTtlSeconds });
  const invitations = new InvitationService(repositories);
  const auth = new AuthService({ client, repositories, invitations, sessions, publicBaseUrl: config.publicBaseUrl, googleClientId: config.googleClientId, googleClientSecret: config.googleClientSecret, googleCallbackUrl: config.googleCallbackUrl });
  const users = new UserService(repositories, config.publicBaseUrl);
  const pairing = new HardwareEnrollmentService({ client, pepper: config.pairingPepper, ttlSeconds: config.pairingTtlSeconds });
  const devices = new DeviceService(client, repositories, async (unpaired) => {
    try {
      const enrollment = await pairing.issueForHardware({
        hardwareId: unpaired.hardwareId,
        tokenHash: unpaired.tokenHash,
        bypassCooldown: true,
      });
      if (enrollment) {
        await pairing.sendPairingCode(unpaired.hardwareId, enrollment.code, enrollment.expiresAt);
      }
    } catch (err) {
      options.logger?.warn({ hardware_id: unpaired.hardwareId, err }, "failed to issue pairing code on unpair");
    }
  });
  const settings = new SettingsService(client, repositories);
  const recovery = new RecoveryService(client, repositories, {
    ttlSeconds: config.recoveryTokenTtlSeconds,
    maxAttempts: config.recoveryMaxAttempts,
  });
  const profile = new ProfileService(repositories, config.publicBaseUrl);
  const personalization = new PersonalizationService(repositories);
  const avatarStorage = new AvatarStorage(config.avatarStorageDir, config.avatarMaxBytes);
  const avatars = new AvatarService(client, avatarStorage, config.publicBaseUrl, {
    intervalMs: config.avatarGcIntervalMs,
    graceMs: config.avatarGcGraceMs,
    scanLimit: config.avatarGcScanLimit,
    batchSize: config.avatarGcBatchSize,
  });
  const deviceBinding = new DeviceBindingService(repositories);
  const masterKey = crypto.createHash("sha256").update(config.jwtSecret, "utf8").digest();
  const provisioning = new ProvisioningService({
    client,
    masterKey,
    mobileEvents: options.mobileEvents ?? noMobileEvents,
  });
  const memoryGateway = new PostgresMemoryGateway(repositories);
  const memory = new MemoryService({ client, repositories, hermes: options.hermes });
  const proactive = new ProactiveDeliveryService({ client, repositories, mobileEvents: options.mobileEvents ?? noMobileEvents });
  if (!config.wifiEncryptionKey) throw new Error("P9 runtime requires P9_WIFI_ENCRYPTION_KEY");
  const deviceAdditions = new DeviceAdditionsService({ client, repositories, encryptionKey: decodeWifiEncryptionKey(config.wifiEncryptionKey), deviceEvents: { sendToDevice: () => false } });
  const schedule = new ScheduleService({ client, repositories, mobileEvents: options.mobileEvents ?? noMobileEvents });
  const spotify = config.spotifyClientId && config.spotifyClientSecret
    ? new SpotifyApiClient({ clientId: config.spotifyClientId, clientSecret: config.spotifyClientSecret })
    : undefined;
  // The dedicated bridge is a personal-account transport. The bridge's
  // destructive queue is ingested here, while notification authorization is
  // owned by WhatsAppNotificationRule in the Backend.
  const whatsApp = new HermesWhatsAppBridgeClient({ baseUrl: config.whatsappBridgeUrl });
  const whatsAppPairing = new HermesWhatsAppPairingClient({ baseUrl: config.whatsappPairingUrl });
  const whatsAppIdentity = new HermesWhatsAppIdentityResolverClient({ baseUrl: config.whatsappIdentityResolverUrl, token: config.whatsappIdentityResolverToken });

  const speechArbiter = new DeviceSpeechArbiterService(
    {
      resolveP9DeviceId: async (hardwareBinding) => {
        const binding = await repositories.device.findFirst({
          where: { hardwareId: hardwareBinding, status: "ACTIVE", revokedAt: null },
          select: { id: true },
        });
        return binding?.id ?? hardwareBinding;
      },
    },
    new PrismaDeviceSpeechArbiterStore(),
    {
      run: (work) => client.$transaction(work),
    },
  );

  const proactiveDeliveryRepo = new ProactiveDeliveryRepository(client);
  let activeSocketBridge: DeviceSocketBridge | undefined;

  const deviceSpeechPort = new OneShotDeviceSpeechPort(
    speechArbiter,
    proactiveDeliveryRepo,
    {
      isDeviceOnlineAndIdle: async (deviceId) => {
        if (activeSocketBridge) return activeSocketBridge.isDeviceOnlineAndIdle(deviceId);
        return { online: false, idle: false };
      },
      sendEvent: async (deviceId, event) => {
        if (activeSocketBridge) return activeSocketBridge.sendEvent(deviceId, event);
        return false;
      },
    },
    options.audioService as any,
    options.tempAudio as any,
  );

  const integrations = new IntegrationService({
    client,
    repositories,
    publicBaseUrl: config.publicBaseUrl,
    ...(config.spotifyTokenEncryptionKey === undefined ? {} : { spotifyTokenEncryptionKey: config.spotifyTokenEncryptionKey }),
    ...(config.spotifyClientId === undefined ? {} : { spotifyClientId: config.spotifyClientId }),
    ...(config.spotifyClientSecret === undefined ? {} : { spotifyClientSecret: config.spotifyClientSecret }),
    ...(config.spotifyCallbackUrl === undefined ? {} : { spotifyCallbackUrl: config.spotifyCallbackUrl }),
    ...(spotify === undefined ? {} : { spotify }),
    whatsApp,
    whatsAppPairing,
    whatsAppIdentity,
    mobileEvents: options.mobileEvents ?? noMobileEvents,
    whatsAppProactiveDelivery: async (input) => {
      try {
        await deviceSpeechPort.deliverWhatsAppSpeechOnce({
          userId: input.userId,
          deviceId: input.deviceId,
          deliveryId: input.deliveryId,
          senderName: input.senderName,
          text: input.text,
        });
      } catch (err: unknown) {
        options.logger?.warn({ err, deliveryId: input.deliveryId }, "failed to deliver WhatsApp speech once");
      }
      await proactive.enqueue({
        userId: input.userId,
        deviceId: input.deviceId,
        source: "WHATSAPP",
        sourceResourceType: "whatsapp_delivery",
        sourceResourceId: input.deliveryId,
        idempotencyKey: `whatsapp:${input.deliveryId}`,
      });
    },
  });
  const bugReports = new BugReportService({
    client,
    repositories,
    storageDir: config.bugReportStorageDir,
    resendApiKey: config.resendApiKey,
    supportNotificationEmail: config.supportNotificationEmail,
    supportNotificationEmails: config.supportNotificationEmails,
    supportFromEmail: config.supportFromEmail,
    logger: options.logger,
  });

  const pushNotifications = new PushNotificationService(repositories);
  const scheduleChatRepo = new ScheduleChatRepository(client);
  const scheduledResultService = new ScheduledResultService(
    {
      generate: async ({ system, prompt }) => {
        const fullPrompt = system + "\n\n" + prompt;
        if (options.hermes) {
          return options.hermes.generate(fullPrompt, undefined, {
            conversation: "schedule-generator",
            sessionKey: "joy:system:scheduler",
          });
        }
        return "Pengingat jadwal kamu sudah tiba.";
      },
    },
    {
      persistSuccess: async ({ runId, userId, content, targetSessionId }) => {
        const message = await scheduleChatRepo.appendRunResult({
          userId,
          scheduleRunId: runId,
          content,
          targetSessionId,
        });
        const run = await repositories.scheduleRun.findFirstOrThrow({
          where: { id: runId },
        });
        return { message, run };
      },
      markFailed: async (runId, reason) => {
        const workerId = "scheduler:" + process.pid;
        await repositories.finishScheduleRun({
          runId,
          workerId,
          status: "FAILED",
          errorCode: reason,
        });
      },
    },
    {
      emitBestEffort: async (userId, event) => {
        if (options.mobileEvents) {
          options.mobileEvents.sendToUser(userId, event as any);
        }
      },
    },
    deviceSpeechPort,
    pushNotifications,
  );
  const chat = new ChatService({
    integrations,
    client,
    repositories,
    hermes: options.hermes ?? unavailableHermes,
    mobileEvents: options.mobileEvents ?? noMobileEvents,
    hardTimeoutMs: options.chatHardTimeoutMs ?? 180_000,
    memoryContext: memoryGateway,
  });
  return {
    router: createP9Router({ auth, sessions, users, devices, pairing, provisioning, settings, recovery, profile, avatars, personalization, chat, integrations, schedule, memory, bugReports, deviceAdditions, pushNotifications, accessTokens, repositories, config, includeOps: options.includeOps ?? false, audioService: options.audioService, tempAudio: options.tempAudio, publicBaseUrl: options.publicBaseUrl }),
    mediaRouter: createAvatarMediaRouter(avatarStorage),
    initialize: async () => {
      await avatarStorage.initialize();
    },
    reconcileAvatars: () => avatars.reconcile(),
    resolveDeviceBinding: (hardwareId, deviceToken) => deviceBinding.resolve(hardwareId, deviceToken),
    authorizeDeviceBinding: (binding) => deviceBinding.isActive(binding),
    issueHardwareEnrollment: (hardwareId, tokenHash) => pairing.issueForHardware({ hardwareId, tokenHash }),
    setHardwareEventSender: (sender) => pairing.setHardwareEventSender(sender),
    setDeviceSocketBridge: (bridge) => { activeSocketBridge = bridge; integrations.setDeviceSocketBridge(bridge); },
    authenticateMobileSocket: (accessToken) =>
      authenticateMobileAccessToken(accessTokens, sessions, accessToken),
    provisioning,
    handleDeviceReset: (hardwareId, event) => provisioning.handleDeviceReset(hardwareId, event),
    completeSessionOnRuntimeAuth: (hardwareId, deviceId) => provisioning.completeSessionOnRuntimeAuth(hardwareId, deviceId),
    checkReadiness: () => checkP9Readiness(repositories),
    pollWhatsApp: () => integrations.pollWhatsApp(),
    voiceChatHandler: {
      prepareContext: (hardwareId: string, text: string) => chat.prepareVoiceContext(hardwareId, text),
      onResponse: (result) => chat.recordVoiceInteraction({
        hardwareId: result.deviceId,
        ...(result.userId ? { userId: result.userId } : {}),
        ...(result.sessionId ? { sessionId: result.sessionId } : {}),
        ...(result.userMessageId ? { userMessageId: result.userMessageId } : {}),
        userText: result.userText,
        responseText: result.responseText,
      }),
      handleIntent: async (input) => {
        if (!input.userId) return { handled: false };
        return chat.handleUnifiedVoiceActionIntent(input.userId, input.text);
      },
    },
    
    resumePendingChat: () => chat.resumePending(),
    launchPendingChatRecovery: (onError) => {
      void chat.resumePending().catch((error) => onError?.(error));
    },
    waitForChatIdle: () => chat.waitForIdle(),
    runScheduler: async () => {
      const workerId = "scheduler:" + process.pid;
      const missed = await repositories.materializeMissedScheduleRuns({ limit: 100, missedAfterMs: 300_000 });
      for (const occurrence of missed) await schedule.advanceOccurrence(occurrence.scheduleId, occurrence.dueAt, occurrence.recurrence as any);
      const occurrences = await repositories.materializeDueScheduleRuns({ limit: 100, missedAfterMs: 300_000 });
      const claimed = await repositories.claimScheduleRuns({ workerId, limit: 100, leaseMs: 30_000 });
      for (const run of claimed as any[]) {
        try {
          await scheduledResultService.completeClaimedRun({
            id: run.id,
            scheduleId: run.scheduleId,
            userId: run.userId,
            targetDeviceId: run.targetDeviceId ?? null,
            status: "CLAIMED",
            dueAt: run.dueAt,
            payload: run.payload,
          });
          await schedule.advanceOccurrence(run.scheduleId, run.dueAt, run.recurrence as any);
          await repositories.finishScheduleRun({ runId: run.id, workerId, status: "SUCCEEDED" });
        } catch (err: any) {
          const databaseNow = await repositories.databaseNow();
          await repositories.finishScheduleRun({
            runId: run.id,
            workerId,
            status: "FAILED",
            errorCode: err?.message ?? "DELIVERY_FAILED",
            retryAt: new Date(databaseNow.getTime() + 30_000),
          });
        }
      }
      const worker = await proactive.processOnce();
      return { materialized: occurrences.length + missed.length, claimed: claimed.length, pendingPhysical: worker.pendingPhysical };
    },
    deviceAdditions,
    settings,
    close: async () => {
      await chat.close();
      await avatarStorage.close();
      await disconnectP9Client(client);
    },
  };
}
