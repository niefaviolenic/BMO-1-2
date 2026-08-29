import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  ScheduledResultService,
  type HermesScheduleResultGenerator,
  type ScheduledResultRepository,
  type MobileEventsEmitter,
  type ClaimedScheduleRun,
} from "../../src/services/scheduled-result.service.js";
import type { DeviceSpeechPort } from "../../src/device-speech.port.js";
import type { ChatMessage, ScheduleRun } from "../../src/generated/prisma/client.js";

describe("ScheduledResultService", () => {
  const userId = randomUUID();
  const runId = randomUUID();
  const scheduleId = randomUUID();
  const deviceId = randomUUID();

  const claimedRun: ClaimedScheduleRun = {
    id: runId,
    scheduleId,
    userId,
    targetDeviceId: deviceId,
    status: "CLAIMED",
    dueAt: new Date(),
    payload: { title: "Minum Obat", text: "Minum vitamin C" },
  };

  function fixture() {
    const hermes: HermesScheduleResultGenerator = {
      generate: vi.fn(),
    };
    const repository: ScheduledResultRepository = {
      persistSuccess: vi.fn(),
      markFailed: vi.fn(),
    };
    const mobileEvents: MobileEventsEmitter = {
      emitBestEffort: vi.fn(),
    };
    const deviceSpeech: DeviceSpeechPort = {
      deliverScheduleOnce: vi.fn(),
      deliverWhatsAppSpeechOnce: vi.fn(),
    };
    const service = new ScheduledResultService(
      hermes,
      repository,
      mobileEvents,
      deviceSpeech,
    );
    return { hermes, repository, mobileEvents, deviceSpeech, service };
  }

  it("completes run on first valid Hermes output", async () => {
    const { hermes, repository, mobileEvents, deviceSpeech, service } = fixture();
    const fakeMessage = {
      id: randomUUID(),
      sessionId: randomUUID(),
      userId,
      role: "ASSISTANT",
      createdAt: new Date(),
      content: "Waktunya minum vitamin C!",
    } as unknown as ChatMessage;

    vi.mocked(hermes.generate).mockResolvedValue("Waktunya minum vitamin C!");
    vi.mocked(repository.persistSuccess).mockResolvedValue({
      message: fakeMessage,
      run: { id: runId, status: "SUCCEEDED" } as unknown as ScheduleRun,
    });
    vi.mocked(deviceSpeech.deliverScheduleOnce).mockResolvedValue({
      status: "SENT",
      deliveryId: randomUUID(),
      attemptId: randomUUID(),
      leaseId: randomUUID(),
    });

    const result = await service.completeClaimedRun(claimedRun);
    expect(result.ok).toBe(true);
    expect(hermes.generate).toHaveBeenCalledTimes(1);
    expect(repository.persistSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        runId,
        userId,
        content: "Waktunya minum vitamin C!",
      }),
    );
  });

  it("repairs invalid output once and succeeds", async () => {
    const { hermes, repository, service } = fixture();
    const fakeMessage = {
      id: randomUUID(),
      sessionId: randomUUID(),
      userId,
      role: "ASSISTANT",
      createdAt: new Date(),
      content: "Minum vitamin sekarang.",
    } as unknown as ChatMessage;

    vi.mocked(hermes.generate)
      .mockResolvedValueOnce("Satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas")
      .mockResolvedValueOnce("Minum vitamin sekarang.");
    vi.mocked(repository.persistSuccess).mockResolvedValue({
      message: fakeMessage,
      run: { id: runId, status: "SUCCEEDED" } as unknown as ScheduleRun,
    });

    const result = await service.completeClaimedRun({ ...claimedRun, targetDeviceId: null });
    expect(result.ok).toBe(true);
    expect(hermes.generate).toHaveBeenCalledTimes(2);
    expect(repository.persistSuccess).toHaveBeenCalled();
  });

  it("falls back to friendly reminder if generation errors out", async () => {
    const { hermes, repository, service } = fixture();
    const fakeMessage = {
      id: randomUUID(),
      sessionId: randomUUID(),
      userId,
      role: "ASSISTANT",
      createdAt: new Date(),
      content: "Waktunya pengingat kamu sekarang ya!",
    } as unknown as ChatMessage;

    vi.mocked(hermes.generate).mockRejectedValue(new Error("LLM timeout"));
    vi.mocked(repository.persistSuccess).mockResolvedValue({
      message: fakeMessage,
      run: { id: runId, status: "SUCCEEDED" } as unknown as ScheduleRun,
    });

    const result = await service.completeClaimedRun({ ...claimedRun, targetDeviceId: null });
    expect(result.ok).toBe(true);
    expect(repository.persistSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.any(String) }),
    );
  });
});
