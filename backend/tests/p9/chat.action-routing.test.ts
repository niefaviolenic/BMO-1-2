import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ChatService, EmptyChatMemoryContextProvider } from "../../src/p9/services/chat.service.js";
import type { P9Repositories } from "../../src/p9/db/repositories.js";
import { IntegrationProvider, IntegrationStatus } from "../../src/generated/prisma/enums.js";

describe("ChatService Unified AI Action Routing", () => {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const operationId = randomUUID();
  const connectionId = randomUUID();
  const conversationId = randomUUID();
  const deviceId = randomUUID();

  function fixture(options?: {
    isWhatsAppConnected?: boolean;
    isSpotifyConnected?: boolean;
  }) {
    const isWhatsAppConnected = options?.isWhatsAppConnected ?? true;
    const isSpotifyConnected = options?.isSpotifyConnected ?? true;

    const emittedEvents: Array<{ uid: string; event: any }> = [];
    const createdMessages: any[] = [];
    const createdSchedules: any[] = [];

    const repositories = {
      lockUser: vi.fn().mockResolvedValue(undefined),
      chatOperation: {
        findFirst: vi.fn().mockResolvedValue({ id: operationId }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      chatSession: {
        findFirst: vi.fn().mockResolvedValue({ id: sessionId, temporary: false, title: "Chat" }),
        update: vi.fn().mockResolvedValue({ id: sessionId }),
      },
      chatMessage: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: randomUUID(), ...data, createdAt: new Date(), cursor: BigInt(1) };
          createdMessages.push(row);
          return row;
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ displayName: "Rangga", email: "rangga@binerlabs.com" }),
      },
      personalizationSettings: {
        upsert: vi.fn().mockResolvedValue({
          baseStyleTone: "Default",
          warmth: 3,
          enthusiasm: 3,
          headerAndLists: "Automatic",
          emoji: "Automatic",
          fastAnswers: "Automatic",
          customInstructions: null,
        }),
      },
      device: {
        findFirst: vi.fn().mockResolvedValue({ id: deviceId, name: "Joy Desk Robot" }),
      },
      schedule: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: randomUUID(), ...data };
          createdSchedules.push(row);
          return row;
        }),
      },
      databaseNow: vi.fn().mockResolvedValue(new Date()),
      integrationConnection: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.userId_provider.provider === IntegrationProvider.WHATSAPP) {
            if (!isWhatsAppConnected) return null;
            return {
              id: connectionId,
              userId,
              provider: IntegrationProvider.WHATSAPP,
              status: IntegrationStatus.CONNECTED,
            };
          }
          if (where.userId_provider.provider === IntegrationProvider.SPOTIFY) {
            if (!isSpotifyConnected) return null;
            return {
              id: randomUUID(),
              userId,
              provider: IntegrationProvider.SPOTIFY,
              status: IntegrationStatus.CONNECTED,
            };
          }
          return null;
        }),
      },
      whatsAppConversation: {
        findMany: vi.fn().mockImplementation(async () => {
          if (!isWhatsAppConnected) return [];
          return [
            {
              id: conversationId,
              userId,
              connectionId,
              displayName: "cenna",
              opaqueChatRef: "628123456789@s.whatsapp.net",
              type: "DM",
              lastActivityAt: new Date(),
            },
          ];
        }),
      },
      whatsAppConversationAlias: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as P9Repositories;

    const mobileEvents = {
      sendToUser: vi.fn().mockImplementation((uid: string, event: any) => {
        emittedEvents.push({ uid, event });
        return 1;
      }),
    };

    const hermes = {
      generate: vi.fn(),
    };

    const integrations = {
      whatsappPreview: vi.fn().mockResolvedValue({
        id: "preview-123",
        status: "PREVIEW_PENDING",
      }),
      whatsappConfirm: vi.fn().mockResolvedValue({
        id: "preview-123",
        status: "DELIVERED",
      }),
      spotifyAction: vi.fn().mockResolvedValue({
        status: "SUCCEEDED",
      }),
    };

    const service = new ChatService({
      integrations: integrations as any,
      repositories,
      transaction: async (work) => work(repositories),
      hermes,
      mobileEvents,
      memoryContext: new EmptyChatMemoryContextProvider(),
      hardTimeoutMs: 10_000,
    });

    return {
      repositories,
      mobileEvents,
      hermes,
      integrations,
      createdMessages,
      createdSchedules,
      emittedEvents,
      service,
    };
  }

  it("handles WhatsApp slang command end-to-end via Hermes NLU action routing", async () => {
    const { service, hermes, integrations, createdMessages } = fixture();

    hermes.generate.mockResolvedValue(
      JSON.stringify({
        action: "send_whatsapp",
        recipient: "cenna",
        message: "w mau pulang sumpah demi anjir",
      }),
    );

    const result = await service.handleUnifiedVoiceActionIntent(
      userId,
      "blg ke cenna w mau pulang sumpah demi anjir",
      sessionId,
      operationId,
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.responseText).toContain("Siap! Pesan WhatsApp sudah dikirim ke cenna");
    expect(result.responseText).toContain("w mau pulang sumpah demi anjir");
    expect(integrations.whatsappPreview).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        conversationId,
        message: "w mau pulang sumpah demi anjir",
      }),
    );
    expect(integrations.whatsappConfirm).toHaveBeenCalledWith(userId, "preview-123");
  });

  it("handles Spotify slang query end-to-end via Hermes NLU action routing", async () => {
    const { service, hermes, integrations } = fixture();

    hermes.generate.mockResolvedValue(
      JSON.stringify({
        action: "control_spotify",
        sub_action: "PLAY",
        query: "komang",
      }),
    );

    const result = await service.handleUnifiedVoiceActionIntent(
      userId,
      "puterin lagu komang dong",
      sessionId,
      operationId,
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.responseText).toContain('Sedang memutar "komang" di Spotify!');
    expect(integrations.spotifyAction).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        action: "PLAY",
        payload: { query: "komang" },
        confirmed: true,
      }),
    );
  });

  it("handles Schedule slang command end-to-end via Hermes NLU action routing", async () => {
    const { service, hermes, createdSchedules, emittedEvents } = fixture();

    const dueAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    hermes.generate.mockResolvedValue(
      JSON.stringify({
        action: "create_schedule",
        prompt: "angkat jemuran",
        due_at: dueAt,
        exact_time: "15:00",
        date: "2026-08-29",
        frequency: "Once",
        time_label: "5 menit lagi",
      }),
    );

    const result = await service.handleUnifiedVoiceActionIntent(
      userId,
      "ingetin 5 menit lagi angkat jemuran",
      sessionId,
      operationId,
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.responseText).toContain('Joy sudah jadwalkan pengingat "angkat jemuran"');
    expect(result.responseText).toContain("5 menit lagi");
    expect(createdSchedules).toHaveLength(1);
    expect(createdSchedules[0].payload.prompt).toBe("angkat jemuran");
    expect(emittedEvents.some((e) => e.event.event === "schedule_status")).toBe(true);
  });

  it("falls through to conversational response when message has no action cues", async () => {
    const { service, hermes } = fixture();

    const result = await service.handleUnifiedVoiceActionIntent(
      userId,
      "halo joy apa kabar",
      sessionId,
      operationId,
    );

    expect(hermes.generate).not.toHaveBeenCalled();
    expect(result.handled).toBe(false);
  });

  it("falls through to conversational response when message has action cue but Hermes classifies as none", async () => {
    const { service, hermes } = fixture();

    hermes.generate.mockResolvedValue(
      JSON.stringify({
        action: "none",
      }),
    );

    const result = await service.handleUnifiedVoiceActionIntent(
      userId,
      "kirim salam ke semua orang",
      sessionId,
      operationId,
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(result.handled).toBe(false);
  });

  it("provides helpful honest error message when Spotify returns NO_ACTIVE_DEVICE", async () => {
    const { service, hermes, integrations } = fixture();
    integrations.spotifyAction.mockResolvedValue({
      status: "FAILED",
      errorCode: "NO_ACTIVE_DEVICE",
    });
    hermes.generate.mockResolvedValue(
      JSON.stringify({
        action: "control_spotify",
        sub_action: "PLAY",
        query: "bernadya",
      }),
    );
    const result = await service.handleUnifiedVoiceActionIntent(
      userId,
      "laut ddari bernadya",
      sessionId,
      operationId,
    );
    expect(result.handled).toBe(true);
    expect(result.responseText).toContain('Lagu "bernadya" ketemu di Spotify, tapi tidak ada perangkat yang aktif');
    expect(result.responseText).toContain("Buka aplikasi Spotify di HP atau laptopmu");
  });
});
