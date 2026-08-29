import { randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { validateScheduleResult } from "./services/schedule-result.validation.js";
import type {
  DeviceSpeechArbiterService,
} from "./p9/services/device-speech-arbiter.service.js";
import type { ProactiveDeliveryRepository } from "./repositories/proactive-delivery.repository.js";
import type { TempAudioService } from "./services/temp-audio.service.js";
import type { AudioServiceClient } from "./services/audio-service.client.js";

export const PROACTIVE_OFFER_TTL_MS = 5_000;
export const PROACTIVE_SPEECH_LEASE_TTL_MS = 45_000;
export const PUBLIC_AUDIO_ORIGIN = "https://api.personalbmo.web.id";

export type DeviceSpeechOutcome =
  | { status: "SENT"; deliveryId: string; attemptId: string; leaseId: string }
  | { status: "MISSED"; reason: "OFFLINE" | "BUSY" }
  | { status: "FAILED"; reason: string };

export interface DeviceSpeechInput {
  userId: string;
  deviceId: string;
  scheduleRunId: string;
  assistantMessageId: string;
  text: string;
}

export interface WhatsAppSpeechInput {
  userId: string;
  deviceId: string;
  deliveryId: string;
  senderName?: string | null | undefined;
  text: string;
}

export interface DeviceSpeechPort {
  deliverScheduleOnce(input: DeviceSpeechInput): Promise<DeviceSpeechOutcome>;
  deliverWhatsAppSpeechOnce(input: WhatsAppSpeechInput): Promise<DeviceSpeechOutcome>;
}

export interface DeviceSocketBridge {
  isDeviceOnlineAndIdle(deviceId: string): Promise<{ online: boolean; idle: boolean; hardwareId?: string }>;
  sendEvent(deviceId: string, event: unknown): Promise<boolean>;
}

export class OneShotDeviceSpeechPort implements DeviceSpeechPort {
  readonly #emitter = new EventEmitter();

  constructor(
    private readonly arbiter: DeviceSpeechArbiterService,
    private readonly repository: ProactiveDeliveryRepository,
    private readonly socketBridge: DeviceSocketBridge,
    private readonly audioService: AudioServiceClient,
    private readonly tempAudio: TempAudioService,
  ) {}

  notifyOfferAccepted(event: {
    delivery_id: string;
    attempt_id: string;
    offer_receipt: string;
  }): void {
    this.#emitter.emit(`offer_accepted:${event.delivery_id}:${event.attempt_id}`, event);
  }

  async deliverScheduleOnce(
    input: DeviceSpeechInput,
  ): Promise<DeviceSpeechOutcome> {
    const validated = validateScheduleResult(input.text);
    if (!validated.valid) {
      return { status: "FAILED", reason: "INVALID_TEXT" };
    }

    const deviceStatus = await this.socketBridge.isDeviceOnlineAndIdle(input.deviceId);
    if (!deviceStatus.online) {
      return { status: "MISSED", reason: "OFFLINE" };
    }
    if (!deviceStatus.idle) {
      return { status: "MISSED", reason: "BUSY" };
    }

    const hardwareId = deviceStatus.hardwareId ?? input.deviceId;
    const deliveryId = randomUUID();
    const attemptId = randomUUID();

    try {
      // 1. Synthesize audio directly using TTS
      const synth = await this.audioService.synthesize(attemptId, validated.value);
      const audioRecord = await this.tempAudio.createFromBytes(synth.audio);
      const audioUrl = `${PUBLIC_AUDIO_ORIGIN}/audio/${audioRecord.audioId}.mp3`;

      // 2. Send audio_ready directly to the robot device (which plays audio out loud!)
      const readySent = await this.socketBridge.sendEvent(hardwareId, {
        event: "audio_ready",
        request_id: attemptId,
        audio_url: audioUrl,
        format: "mp3",
        expires_in_seconds: 45,
        text: validated.value,
      });

      if (!readySent) {
        return { status: "FAILED", reason: "SOCKET_SEND_FAILED" };
      }

      return {
        status: "SENT",
        deliveryId,
        attemptId,
        leaseId: deliveryId,
      };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : "TTS_OR_AUDIO_FAILED";
      return { status: "FAILED", reason };
    }
  }

  async deliverWhatsAppSpeechOnce(
    input: WhatsAppSpeechInput,
  ): Promise<DeviceSpeechOutcome> {
    const raw = (input.text || "").trim();
    if (!raw) {
      return { status: "FAILED", reason: "EMPTY_TEXT" };
    }

    const truncatedBody = raw.length > 160 ? raw.slice(0, 160) : raw;
    const sender = input.senderName?.trim();
    const spokenText = sender
      ? `Ada pesan WhatsApp dari ${sender}. ${truncatedBody}`
      : `Ada pesan WhatsApp baru. ${truncatedBody}`;

    const deviceStatus = await this.socketBridge.isDeviceOnlineAndIdle(input.deviceId);
    if (!deviceStatus.online) {
      return { status: "MISSED", reason: "OFFLINE" };
    }
    if (!deviceStatus.idle) {
      return { status: "MISSED", reason: "BUSY" };
    }

    const hardwareId = deviceStatus.hardwareId ?? input.deviceId;
    const attemptId = randomUUID();

    try {
      // 1. Synthesize audio directly using TTS
      const synth = await this.audioService.synthesize(attemptId, spokenText);
      const audioRecord = await this.tempAudio.createFromBytes(synth.audio);
      const audioUrl = `${PUBLIC_AUDIO_ORIGIN}/audio/${audioRecord.audioId}.mp3`;

      // 2. Send audio_ready directly to the robot device
      const readySent = await this.socketBridge.sendEvent(hardwareId, {
        event: "audio_ready",
        request_id: attemptId,
        audio_url: audioUrl,
        format: "mp3",
        expires_in_seconds: 45,
        text: spokenText,
      });

      if (!readySent) {
        return { status: "FAILED", reason: "SOCKET_SEND_FAILED" };
      }

      return {
        status: "SENT",
        deliveryId: input.deliveryId,
        attemptId,
        leaseId: input.deliveryId,
      };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : "TTS_OR_AUDIO_FAILED";
      return { status: "FAILED", reason };
    }
  }
}
