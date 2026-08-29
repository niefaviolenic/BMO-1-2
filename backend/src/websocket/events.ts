import { z } from "zod";

const uuid = z.string().uuid();
const uuidV4 = z.string().uuid().refine((value) => value[14]?.toLowerCase() === "4");

export const VoiceReserveEvent = z.object({
  event: z.literal("voice_reserve"),
  request_id: uuid,
}).strict();

export const VoiceReserveAcceptedEvent = z.object({
  event: z.literal("voice_reserve_accepted"),
  request_id: uuid,
  lease_id: uuid,
  reserve_receipt: z.string().min(1).max(512),
  capture_lease_duration_seconds: z.literal(45),
  capture_lease_expires_at: z.string().datetime({ offset: true }),
}).strict();

export const VoiceReserveRejectedEvent = z.object({
  event: z.literal("voice_reserve_rejected"),
  request_id: uuid,
  reason: z.enum([
    "UNAUTHENTICATED",
    "NOT_IDLE",
    "BUSY",
    "STALE_REQUEST",
  ]),
}).strict();

export const VoiceCancelEvent = z.object({
  event: z.literal("voice_cancel"),
  request_id: uuid,
  lease_id: uuid,
  reserve_receipt: z.string().min(1).max(512),
  reason: z.enum([
    "NO_SPEECH",
    "LOCAL_ABORT",
    "UPLOAD_HANDOFF_FAILED",
  ]),
}).strict();

export const VoiceReserveExpiredEvent = z.object({
  event: z.literal("voice_reserve_expired"),
  request_id: uuid,
  lease_id: uuid,
  reserve_receipt: z.string().min(1).max(512),
}).strict();

export const VoiceUploadHeaders = z.object({
  "x-request-id": uuid,
  "x-voice-lease-id": uuid,
  "x-voice-reserve-receipt": z.string().min(1).max(512),
});

export const ProactiveOfferEvent = z.object({
  event: z.literal("proactive_offer"),
  delivery_id: uuid,
  attempt_id: uuid,
  offer_receipt: z.string().min(1).max(512),
  expires_at_ms: z.number().int().positive(),
}).strict();

export const ProactiveOfferAcceptedEvent = z.object({
  event: z.literal("proactive_offer_accepted"),
  delivery_id: uuid,
  attempt_id: uuid,
  offer_receipt: z.string().min(1).max(512),
}).strict();

export const ProactiveAudioReadyEvent = z.object({
  event: z.literal("proactive_audio_ready"),
  source: z.literal("SCHEDULE"),
  delivery_id: uuid,
  attempt_id: uuid,
  lease_id: uuid,
  audio_url: z.string().url().max(255),
  audio_receipt: z.string().min(1).max(512),
  expires_at_ms: z.number().int().positive(),
}).strict();

export const ProactiveCancelEvent = z.object({
  event: z.literal("proactive_cancel"),
  source: z.literal("SCHEDULE"),
  delivery_id: uuid,
  attempt_id: uuid,
  lease_id: uuid,
}).strict();

export const ProactiveDoneEvent = z.object({
  event: z.literal("proactive_done"),
  source: z.literal("SCHEDULE"),
  delivery_id: uuid,
  attempt_id: uuid,
  lease_id: uuid,
  audio_receipt: z.string().min(1).max(512),
  reason: z.literal("COMPLETED"),
}).strict();

export const ProactiveFailedReason = z.enum([
  "DOWNLOAD_FAILED",
  "DECODE_FAILED",
  "PLAYBACK_FAILED",
  "CANCELLED",
  "LEASE_EXPIRED",
  "WATCHDOG_STALLED",
]);

export const DisplayQrEvent = z.object({
  event: z.literal("display_qr"),
  type: z.string().optional(),
  qr: z.string().min(1).max(512),
  expires_at: z.string().datetime({ offset: true }).optional(),
}).strict();

export const ClearQrEvent = z.object({
  event: z.literal("clear_qr"),
}).strict();

export const ProactiveFailedEvent = z.object({
  event: z.literal("proactive_failed"),
  source: z.literal("SCHEDULE"),
  delivery_id: uuid,
  attempt_id: uuid,
  lease_id: uuid,
  audio_receipt: z.string().min(1).max(512),
  reason: ProactiveFailedReason,
}).strict();

export const DeviceResetEvent = z.object({
  event: z.literal("device_reset"),
  reset_type: z.enum(["PAIRING_RESET", "FACTORY_RESET"]),
  previous_reset_epoch: z.number().int().nonnegative(),
  reset_epoch: z.number().int().positive(),
  reset_nonce: z.string().min(1).max(128),
  reset_proof: z.string().min(1).max(128),
}).strict();

export const DeviceResetAckEvent = z.object({
  event: z.literal("device_reset_ack"),
  reset_epoch: z.number().int().positive(),
}).strict();

export const inboundEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("authenticate"),
    device_id: z.string().min(1),
    device_token: z.string().min(1),
  }).strict(),
  z.object({
    event: z.literal("audio_playback_done"),
    request_id: uuid,
  }).strict(),
  z.object({
    event: z.literal("audio_playback_failed"),
    request_id: uuid,
    reason: z.enum(["DOWNLOAD_FAILED", "DECODE_FAILED", "PLAYBACK_FAILED"]),
  }).strict(),
  z.object({
    event: z.literal("wifi_configuration_received"),
    configuration_id: uuid,
  }).strict(),
  z.object({
    event: z.literal("wifi_configuration_result"),
    configuration_id: uuid,
    status: z.enum(["CONNECTED", "ROLLED_BACK", "FAILED"]),
    rssi: z.number().int().min(-127).max(0).optional(),
    reason: z.enum(["AUTH_FAILED", "SSID_NOT_FOUND", "DHCP_FAILED", "CONNECT_TIMEOUT", "INTERNAL_ERROR"]).optional(),
  }).strict(),
  z.object({
    event: z.literal("device_log"),
    level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]),
    code: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/u),
    message: z.string().min(1).max(1_000),
    timestamp: z.string().datetime({ offset: true }).nullable().optional(),
    metadata: z.record(z.string(), z.union([z.string().max(256), z.number().finite(), z.boolean(), z.null()])).optional(),
  }).strict(),
  z.object({
    event: z.literal("device_telemetry"),
    wifi_connected: z.boolean(),
    wifi_rssi: z.number().int().min(-127).max(0).nullable().optional(),
    battery_percent: z.number().int().min(0).max(100).nullable().optional(),
    firmware_version: z.string().min(1).max(64).optional(),
  }).strict(),
  z.object({
    event: z.literal("device_settings_applied"),
    version: z.number().int().positive(),
  }).strict(),
  z.object({
    event: z.literal("pairing_mode_request"),
  }).strict(),
  VoiceReserveEvent,
  VoiceCancelEvent,
  ProactiveOfferAcceptedEvent,
  ProactiveDoneEvent,
  ProactiveFailedEvent,
  DeviceResetEvent,
]);

export type InboundEvent = z.infer<typeof inboundEventSchema>;
export type BackendState = "idle" | "thinking" | "audio_ready";

export type OutboundEvent =
  | {
      event: "authenticated";
      status: "ok";
      device_id: string;
      backend_state: BackendState;
      active_request_id: string | null;
    }
  | { event: "authentication_failed"; error: "INVALID_DEVICE_CREDENTIALS" }
  | { event: "connection_replaced"; reason: "NEW_CONNECTION_ESTABLISHED" }
  | { event: "display_status"; request_id: string; status: "thinking" }
  | {
      event: "audio_ready";
      request_id: string;
      audio_url: string;
      format: "mp3";
      expires_in_seconds: number;
      transcript?: string;
      response_text?: string;
      text?: string;
    }
  | {
      event: "request_failed";
      request_id: string;
      code:
        | "NO_SPEECH"
        | "INVALID_AUDIO"
        | "STT_FAILED"
        | "HERMES_FAILED"
        | "TTS_FAILED"
        | "AUDIO_EXPIRED"
        | "PIPELINE_TIMEOUT"
        | "INTERNAL_ERROR";
      recoverable: true;
    }
  | {
      event: "wifi_configuration";
      configuration_id: string;
      ssid: string;
      security: "OPEN" | "WPA_PSK";
      password?: string;
    }
  | { event: "device_settings"; version: number; settings: { playback_volume: number } }
  | { event: "pairing_code"; code: string; expires_at: string }
  | { event: "pairing_completed"; status: "ok" }
  | z.infer<typeof VoiceReserveAcceptedEvent>
  | z.infer<typeof VoiceReserveRejectedEvent>
  | z.infer<typeof VoiceReserveExpiredEvent>
  | z.infer<typeof ProactiveOfferEvent>
  | z.infer<typeof ProactiveAudioReadyEvent>
  | z.infer<typeof ProactiveCancelEvent>
  | z.infer<typeof DisplayQrEvent>
  | z.infer<typeof ClearQrEvent>
  | z.infer<typeof DeviceResetAckEvent>;

export type PairingCodeEvent = Extract<OutboundEvent, { event: "pairing_code" }>;
export type PairingCompletedEvent = Extract<OutboundEvent, { event: "pairing_completed" }>;
export type PairingBypassEvent = PairingCodeEvent | PairingCompletedEvent;

export const outboundEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("authenticated"),
    status: z.literal("ok"),
    device_id: z.string(),
    backend_state: z.enum(["idle", "thinking", "audio_ready"]),
    active_request_id: uuid.nullable(),
  }).strict(),
  z.object({ event: z.literal("authentication_failed"), error: z.literal("INVALID_DEVICE_CREDENTIALS") }).strict(),
  z.object({ event: z.literal("connection_replaced"), reason: z.literal("NEW_CONNECTION_ESTABLISHED") }).strict(),
  z.object({ event: z.literal("display_status"), request_id: uuid, status: z.literal("thinking") }).strict(),
  z.object({
    event: z.literal("audio_ready"),
    request_id: uuid,
    audio_url: z.string().url(),
    format: z.literal("mp3"),
    expires_in_seconds: z.number().int().nonnegative(),
    transcript: z.string().optional(),
    response_text: z.string().optional(),
    text: z.string().optional(),
  }).strict(),
  z.object({
    event: z.literal("request_failed"),
    request_id: uuid,
    code: z.enum([
      "NO_SPEECH",
      "INVALID_AUDIO",
      "STT_FAILED",
      "HERMES_FAILED",
      "TTS_FAILED",
      "AUDIO_EXPIRED",
      "PIPELINE_TIMEOUT",
      "INTERNAL_ERROR",
    ]),
    recoverable: z.literal(true),
  }).strict(),
  z.object({
    event: z.literal("wifi_configuration"),
    configuration_id: uuid,
    ssid: z.string().min(1).max(32),
    security: z.enum(["OPEN", "WPA_PSK"]),
    password: z.string().optional(),
  }).strict(),
  z.object({
    event: z.literal("device_settings"),
    version: z.number().int().positive(),
    settings: z.object({ playback_volume: z.number().int().min(0).max(100) }).strict(),
  }).strict(),
  z.object({
    event: z.literal("pairing_code"),
    code: z.string().regex(/^\d{6}$/u),
    expires_at: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({ event: z.literal("pairing_completed"), status: z.literal("ok") }).strict(),
  VoiceReserveAcceptedEvent,
  VoiceReserveRejectedEvent,
  VoiceReserveExpiredEvent,
  ProactiveOfferEvent,
  ProactiveAudioReadyEvent,
  ProactiveCancelEvent,
  DisplayQrEvent,
  ClearQrEvent,
  DeviceResetAckEvent,
]);
