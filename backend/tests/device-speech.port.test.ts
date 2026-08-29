import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  OneShotDeviceSpeechPort,
  type DeviceSocketBridge,
  type DeviceSpeechInput,
  type WhatsAppSpeechInput,
} from "../src/device-speech.port.js";
import type { DeviceSpeechArbiterService } from "../src/p9/services/device-speech-arbiter.service.js";
import type { ProactiveDeliveryRepository } from "../src/repositories/proactive-delivery.repository.js";
import type { AudioServiceClient } from "../src/services/audio-service.client.js";
import type { TempAudioService } from "../src/services/temp-audio.service.js";

describe("OneShotDeviceSpeechPort", () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  const scheduleRunId = randomUUID();
  const assistantMessageId = randomUUID();

  const input: DeviceSpeechInput = {
    userId,
    deviceId,
    scheduleRunId,
    assistantMessageId,
    text: "Waktunya bangun pagi!",
  };

  const whatsAppInput: WhatsAppSpeechInput = {
    userId,
    deviceId,
    deliveryId: "deliv-123",
    senderName: "Budi",
    text: "Halo, jangan lupa meeting jam 2 ya.",
  };

  function fixture() {
    const arbiter = {
      acquire: vi.fn(),
      promote: vi.fn(),
      release: vi.fn(),
    } as unknown as DeviceSpeechArbiterService;

    const repository = {
      createDeliveringAttempt: vi.fn(),
      markAttemptSent: vi.fn(),
      markAttemptPlayed: vi.fn(),
      markAttemptFailed: vi.fn(),
    } as unknown as ProactiveDeliveryRepository;

    const socketBridge: DeviceSocketBridge = {
      isDeviceOnlineAndIdle: vi.fn(),
      sendEvent: vi.fn(),
    };

    const audioService = {
      synthesize: vi.fn(),
    } as unknown as AudioServiceClient;

    const tempAudio = {
      createFromBytes: vi.fn(),
    } as unknown as TempAudioService;

    const port = new OneShotDeviceSpeechPort(
      arbiter,
      repository,
      socketBridge,
      audioService,
      tempAudio,
    );

    return { arbiter, repository, socketBridge, audioService, tempAudio, port };
  }

  describe("deliverScheduleOnce", () => {
    it("returns MISSED/OFFLINE when device is offline", async () => {
      const { socketBridge, port } = fixture();
      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: false,
        idle: false,
      });

      const outcome = await port.deliverScheduleOnce(input);
      expect(outcome).toEqual({ status: "MISSED", reason: "OFFLINE" });
    });

    it("returns MISSED/BUSY when device is not idle", async () => {
      const { socketBridge, port } = fixture();
      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: false,
      });

      const outcome = await port.deliverScheduleOnce(input);
      expect(outcome).toEqual({ status: "MISSED", reason: "BUSY" });
    });

    it("synthesizes audio and delivers audio_ready directly to robot", async () => {
      const { socketBridge, audioService, tempAudio, port } = fixture();

      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: true,
        hardwareId: "joy-001",
      });

      vi.mocked(socketBridge.sendEvent).mockResolvedValue(true);
      vi.mocked(audioService.synthesize).mockResolvedValue({
        audio: Buffer.from("fake-mp3-bytes"),
        ttsEngine: "piper",
      });
      vi.mocked(tempAudio.createFromBytes).mockResolvedValue({
        audioId: "audio-uuid-123",
        path: "/tmp/audio.mp3",
        size: 100,
        expiresAt: Date.now() + 45_000,
      });

      const outcome = await port.deliverScheduleOnce(input);
      expect(outcome.status).toBe("SENT");
      expect(audioService.synthesize).toHaveBeenCalled();
      expect(tempAudio.createFromBytes).toHaveBeenCalled();
      expect(socketBridge.sendEvent).toHaveBeenCalledWith(
        "joy-001",
        expect.objectContaining({
          event: "audio_ready",
          format: "mp3",
          text: "Waktunya bangun pagi!",
        }),
      );
    });
  });

  describe("deliverWhatsAppSpeechOnce", () => {
    it("returns FAILED/EMPTY_TEXT when text is empty", async () => {
      const { port } = fixture();
      const outcome = await port.deliverWhatsAppSpeechOnce({
        ...whatsAppInput,
        text: "   ",
      });
      expect(outcome).toEqual({ status: "FAILED", reason: "EMPTY_TEXT" });
    });

    it("returns MISSED/OFFLINE when device is offline", async () => {
      const { socketBridge, port } = fixture();
      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: false,
        idle: false,
      });

      const outcome = await port.deliverWhatsAppSpeechOnce(whatsAppInput);
      expect(outcome).toEqual({ status: "MISSED", reason: "OFFLINE" });
    });

    it("returns MISSED/BUSY when device is not idle", async () => {
      const { socketBridge, port } = fixture();
      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: false,
      });

      const outcome = await port.deliverWhatsAppSpeechOnce(whatsAppInput);
      expect(outcome).toEqual({ status: "MISSED", reason: "BUSY" });
    });

    it("synthesizes audio with senderName and sends audio_ready to robot", async () => {
      const { socketBridge, audioService, tempAudio, port } = fixture();

      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: true,
        hardwareId: "joy-002",
      });

      vi.mocked(socketBridge.sendEvent).mockResolvedValue(true);
      vi.mocked(audioService.synthesize).mockResolvedValue({
        audio: Buffer.from("fake-mp3-bytes"),
        ttsEngine: "piper",
      });
      vi.mocked(tempAudio.createFromBytes).mockResolvedValue({
        audioId: "audio-uuid-456",
        path: "/tmp/audio.mp3",
        size: 120,
        expiresAt: Date.now() + 45_000,
      });

      const outcome = await port.deliverWhatsAppSpeechOnce(whatsAppInput);
      expect(outcome.status).toBe("SENT");
      if (outcome.status === "SENT") {
        expect(outcome.deliveryId).toBe("deliv-123");
        expect(outcome.leaseId).toBe("deliv-123");
        expect(outcome.attemptId).toBeDefined();
      }

      const expectedText = "Ada pesan WhatsApp dari Budi. Halo, jangan lupa meeting jam 2 ya.";
      expect(audioService.synthesize).toHaveBeenCalledWith(expect.any(String), expectedText);
      expect(socketBridge.sendEvent).toHaveBeenCalledWith(
        "joy-002",
        expect.objectContaining({
          event: "audio_ready",
          audio_url: "https://api.personalbmo.web.id/audio/audio-uuid-456.mp3",
          format: "mp3",
          expires_in_seconds: 45,
          text: expectedText,
        }),
      );
    });

    it("synthesizes audio without senderName correctly", async () => {
      const { socketBridge, audioService, tempAudio, port } = fixture();

      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: true,
        hardwareId: "joy-002",
      });

      vi.mocked(socketBridge.sendEvent).mockResolvedValue(true);
      vi.mocked(audioService.synthesize).mockResolvedValue({
        audio: Buffer.from("fake-mp3-bytes"),
        ttsEngine: "piper",
      });
      vi.mocked(tempAudio.createFromBytes).mockResolvedValue({
        audioId: "audio-uuid-789",
        path: "/tmp/audio.mp3",
        size: 150,
        expiresAt: Date.now() + 45_000,
      });

      const outcome = await port.deliverWhatsAppSpeechOnce({
        ...whatsAppInput,
        senderName: undefined,
        text: "Pesan penting.",
      });

      expect(outcome.status).toBe("SENT");
      const expectedText = "Ada pesan WhatsApp baru. Pesan penting.";
      expect(audioService.synthesize).toHaveBeenCalledWith(expect.any(String), expectedText);
      expect(socketBridge.sendEvent).toHaveBeenCalledWith(
        "joy-002",
        expect.objectContaining({
          event: "audio_ready",
          text: expectedText,
        }),
      );
    });

    it("truncates message body longer than 160 characters", async () => {
      const { socketBridge, audioService, tempAudio, port } = fixture();

      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: true,
        hardwareId: "joy-002",
      });

      vi.mocked(socketBridge.sendEvent).mockResolvedValue(true);
      vi.mocked(audioService.synthesize).mockResolvedValue({
        audio: Buffer.from("fake-mp3-bytes"),
        ttsEngine: "piper",
      });
      vi.mocked(tempAudio.createFromBytes).mockResolvedValue({
        audioId: "audio-uuid-999",
        path: "/tmp/audio.mp3",
        size: 200,
        expiresAt: Date.now() + 45_000,
      });

      const longText = "A".repeat(200);
      const outcome = await port.deliverWhatsAppSpeechOnce({
        ...whatsAppInput,
        senderName: "Siti",
        text: longText,
      });

      expect(outcome.status).toBe("SENT");
      const expectedText = `Ada pesan WhatsApp dari Siti. ${"A".repeat(160)}`;
      expect(audioService.synthesize).toHaveBeenCalledWith(expect.any(String), expectedText);
    });

    it("returns FAILED/SOCKET_SEND_FAILED when socket event fails", async () => {
      const { socketBridge, audioService, tempAudio, port } = fixture();

      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: true,
        hardwareId: "joy-002",
      });

      vi.mocked(socketBridge.sendEvent).mockResolvedValue(false);
      vi.mocked(audioService.synthesize).mockResolvedValue({
        audio: Buffer.from("fake-mp3-bytes"),
        ttsEngine: "piper",
      });
      vi.mocked(tempAudio.createFromBytes).mockResolvedValue({
        audioId: "audio-uuid-456",
        path: "/tmp/audio.mp3",
        size: 120,
        expiresAt: Date.now() + 45_000,
      });

      const outcome = await port.deliverWhatsAppSpeechOnce(whatsAppInput);
      expect(outcome).toEqual({ status: "FAILED", reason: "SOCKET_SEND_FAILED" });
    });

    it("returns FAILED when audio synthesis fails", async () => {
      const { socketBridge, audioService, port } = fixture();

      vi.mocked(socketBridge.isDeviceOnlineAndIdle).mockResolvedValue({
        online: true,
        idle: true,
        hardwareId: "joy-002",
      });

      vi.mocked(audioService.synthesize).mockRejectedValue(new Error("TTS service timed out"));

      const outcome = await port.deliverWhatsAppSpeechOnce(whatsAppInput);
      expect(outcome).toEqual({ status: "FAILED", reason: "TTS service timed out" });
    });
  });
});
