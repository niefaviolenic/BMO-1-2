import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ChatService, EmptyChatMemoryContextProvider } from "../../src/p9/services/chat.service.js";
import type { P9Repositories } from "../../src/p9/db/repositories.js";

describe("ChatService Schedule Intent Integration", () => {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const operationId = randomUUID();
  const deviceId = randomUUID();

  interface CreatedSchedule {
    id: string;
    targetDeviceId: string;
    payload: { prompt: string };
    recurrence: { exactTime?: string; type: string };
    status: string;
    timezone: string;
    nextRunAt: Date;
  }

  interface EmittedEvent {
    uid: string;
    event: { event: string; status?: string; scheduleId?: string };
  }

  function fixture() {
    const createdSchedules: CreatedSchedule[] = [];
    const emittedEvents: EmittedEvent[] = [];
    const repositories = {
      device: {
        findFirst: vi.fn().mockResolvedValue({
          id: deviceId,
          name: "Joy Table Robot",
        }),
      },
      schedule: {
        create: vi.fn().mockImplementation(async ({ data }: { data: Omit<CreatedSchedule, "id"> }) => {
          const row = { id: randomUUID(), ...data };
          createdSchedules.push(row);
          return row;
        }),
      },
      lockUser: vi.fn().mockResolvedValue(undefined),
      chatOperation: {
        findFirst: vi.fn().mockResolvedValue({ id: operationId }),
        update: vi.fn().mockResolvedValue({ id: operationId }),
      },
      chatSession: {
        findFirst: vi.fn().mockResolvedValue({ id: sessionId, temporary: false, title: "Chat" }),
        update: vi.fn().mockResolvedValue({ id: sessionId }),
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({ id: randomUUID(), role: "ASSISTANT" }),
      },
      databaseNow: vi.fn().mockResolvedValue(new Date()),
      integrationConnection: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as P9Repositories;

    const mobileEvents = {
      sendToUser: vi.fn().mockImplementation((uid: string, event: EmittedEvent["event"]) => {
        emittedEvents.push({ uid, event });
        return 1;
      }),
    };

    const hermes = {
      generate: vi.fn(),
    };

    const service = new ChatService({
      repositories,
      transaction: async (work) => work(repositories),
      hermes,
      mobileEvents,
      memoryContext: new EmptyChatMemoryContextProvider(),
      hardTimeoutMs: 10_000,
    });

    return { repositories, mobileEvents, hermes, createdSchedules, emittedEvents, service };
  }

  it("extracts schedule directly via Hermes NLU, creates DB schedule, and returns friendly confirmation", async () => {
    const { service, hermes, createdSchedules, emittedEvents } = fixture();
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    hermes.generate.mockResolvedValue(
      JSON.stringify({
        is_schedule: true,
        prompt: "meeting penting",
        due_at: dueAt,
        exact_time: "08:52",
        date: "2026-08-28",
        frequency: "Once",
        time_label: "jam 08.52 besok",
      }),
    );

    const voiceResult = await service.handleVoiceScheduleIntent(
      userId,
      "Hai Joy ingetin gw jam 8.52 untuk meeting penting",
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(voiceResult.handled).toBe(true);
    expect(voiceResult.responseText ?? "").toContain('Joy sudah jadwalkan pengingat "meeting penting"');
    expect(voiceResult.responseText ?? "").toContain("jam 08.52 besok");
    expect(voiceResult.responseText ?? "").toContain("Joy Table Robot");
    expect(createdSchedules).toHaveLength(1);
    expect(createdSchedules[0]?.targetDeviceId).toBe(deviceId);
    expect(createdSchedules[0]?.payload.prompt).toBe("meeting penting");
    expect(createdSchedules[0]?.status).toBe("ACTIVE");
    expect(emittedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: userId,
          event: expect.objectContaining({
            event: "schedule_status",
            status: "ACTIVE",
          }),
        }),
      ]),
    );
  });

  it("handles elongated typo 'ingetin 1mmmmeeeenit lagi buat minum kopi' via Hermes NLU, creates DB schedule, and returns friendly confirmation", async () => {
    const { service, hermes, createdSchedules, emittedEvents } = fixture();

    // 1 minute in the future
    const dueAt = new Date(Date.now() + 60 * 1000).toISOString();
    hermes.generate.mockResolvedValue(
      JSON.stringify({
        is_schedule: true,
        prompt: "minum kopi",
        due_at: dueAt,
        exact_time: "11:07",
        date: "2026-08-27",
        frequency: "Once",
        time_label: "1 menit lagi",
      }),
    );

    const voiceResult = await service.handleVoiceScheduleIntent(
      userId,
      "ingetin 1mmmmeeeenit lagi buat minum kopi",
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(voiceResult.handled).toBe(true);
    expect(voiceResult.responseText ?? "").toContain('Joy sudah jadwalkan pengingat "minum kopi"');
    expect(voiceResult.responseText ?? "").toContain("1 menit lagi");
    expect(voiceResult.responseText ?? "").toContain("Joy Table Robot");
    expect(createdSchedules).toHaveLength(1);
    expect(createdSchedules[0]?.payload.prompt).toBe("minum kopi");
    expect(createdSchedules[0]?.status).toBe("ACTIVE");
    expect(createdSchedules[0]?.timezone).toBe("Asia/Jakarta");
    expect(emittedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: userId,
          event: expect.objectContaining({
            event: "schedule_status",
            status: "ACTIVE",
          }),
        }),
      ]),
    );
  });

  it("skips Hermes NLU and falls through (handled: false) when hasScheduleCue is false", async () => {
    const { service, hermes, createdSchedules, emittedEvents } = fixture();

    const voiceResult = await service.handleVoiceScheduleIntent(
      userId,
      "Halo Joy apa kabar hari ini",
    );

    expect(hermes.generate).not.toHaveBeenCalled();
    expect(voiceResult.handled).toBe(false);
    expect(createdSchedules).toHaveLength(0);
    expect(emittedEvents).toHaveLength(0);
  });

  it("falls through to standard chat (handled: false) when Hermes returns is_schedule: false", async () => {
    const { service, hermes, createdSchedules, emittedEvents } = fixture();

    hermes.generate.mockResolvedValue(JSON.stringify({ is_schedule: false }));

    const voiceResult = await service.handleVoiceScheduleIntent(
      userId,
      "Ingetin cerita lucu dong",
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(voiceResult.handled).toBe(false);
    expect(createdSchedules).toHaveLength(0);
    expect(emittedEvents).toHaveLength(0);
  });

  it("resilience: returns handled: false without crashing when Hermes throws an error", async () => {
    const { service, hermes, createdSchedules, emittedEvents } = fixture();

    hermes.generate.mockRejectedValue(new Error("Hermes LLM unavailable"));

    const voiceResult = await service.handleVoiceScheduleIntent(
      userId,
      "Kabarin lusa jam 10 buat jemput adik",
    );

    expect(voiceResult.handled).toBe(false);
    expect(createdSchedules).toHaveLength(0);
    expect(emittedEvents).toHaveLength(0);
  });
});
