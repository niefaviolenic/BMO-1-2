import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ChatService, EmptyChatMemoryContextProvider } from "../../src/p9/services/chat.service.js";
import type { P9Repositories } from "../../src/p9/db/repositories.js";
import { IntegrationProvider, IntegrationStatus } from "../../src/generated/prisma/enums.js";

describe("ChatService WhatsApp Intent Integration", () => {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const operationId = randomUUID();
  const connectionId = randomUUID();
  const conversationId = randomUUID();

  function fixture(options?: {
    connected?: boolean;
    hasContact?: boolean;
    sendSuccess?: boolean;
  }) {
    const isConnected = options?.connected ?? true;
    const hasContact = options?.hasContact ?? true;
    const sendSuccess = options?.sendSuccess ?? true;

    const emittedEvents: Array<{ uid: string; event: any }> = [];
    const createdMessages: any[] = [];

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
          const row = { id: randomUUID(), ...data, createdAt: new Date() };
          createdMessages.push(row);
          return row;
        }),
      },
      databaseNow: vi.fn().mockResolvedValue(new Date()),
      integrationConnection: {
        findUnique: vi.fn().mockImplementation(async () => {
          if (!isConnected) return null;
          return {
            id: connectionId,
            userId,
            provider: IntegrationProvider.WHATSAPP,
            status: IntegrationStatus.CONNECTED,
          };
        }),
      },
      whatsAppConversation: {
        findMany: vi.fn().mockImplementation(async () => {
          if (!hasContact) return [];
          return [
            {
              id: conversationId,
              userId,
              connectionId,
              displayName: "cenna",
              opaqueChatRef: "223385678291143@lid",
              type: "DM",
              lastActivityAt: new Date(),
            },
          ];
        }),
      },
    } as unknown as P9Repositories;

    const mobileEvents = {
      sendToUser: vi.fn().mockImplementation((uid: string, event: any) => {
        emittedEvents.push({ uid, event });
        return 1;
      }),
    };

    const hermes = {
      generate: vi.fn().mockResolvedValue("Hermes fallback answer"),
    };

    const integrations = {
      whatsappPreview: vi.fn().mockResolvedValue({
        id: "preview-123",
        status: "PREVIEW_PENDING",
      }),
      whatsappConfirm: vi.fn().mockResolvedValue({
        id: "preview-123",
        status: sendSuccess ? "DELIVERED" : "FAILED",
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
      emittedEvents,
      service,
    };
  }

  it("detects WhatsApp intent and dispatches message when connected and contact exists", async () => {
    const { service, hermes, integrations, createdMessages } = fixture({
      connected: true,
      hasContact: true,
      sendSuccess: true,
    });

    const result = await service.handleVoiceWhatsAppIntent(
      userId,
      "kirim whatsapp ke cenna dong bilangin ke dia kalo gw dah dirumah",
      sessionId,
      operationId,
    );

    expect(result.handled).toBe(true);
    expect(result.responseText).toContain("Siap! Pesan WhatsApp sudah dikirim ke cenna");
    expect(result.responseText).toContain("gw dah dirumah");
    expect(integrations.whatsappPreview).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        conversationId,
        message: "gw dah dirumah",
      })
    );
    expect(integrations.whatsappConfirm).toHaveBeenCalledWith(userId, "preview-123");
    expect(hermes.generate).not.toHaveBeenCalled();
  });

  it("returns helpful message when WhatsApp is not connected", async () => {
    const { service, hermes, integrations } = fixture({ connected: false });

    const result = await service.handleVoiceWhatsAppIntent(
      userId,
      "kirim whatsapp ke cenna bilang aku otw",
      sessionId,
      operationId,
    );

    expect(result.handled).toBe(true);
    expect(result.responseText).toContain("WhatsApp belum terhubung");
    expect(integrations.whatsappPreview).not.toHaveBeenCalled();
    expect(hermes.generate).not.toHaveBeenCalled();
  });

  it("handles slang / typo 'kriim ke wwwwwwwaaaaaaa cenna bilanggg aku ganteng' via Hermes NLU, finds contact, and dispatches message", async () => {
    const { service, hermes, integrations } = fixture({
      connected: true,
      hasContact: true,
      sendSuccess: true,
    });

    hermes.generate.mockResolvedValue(
      JSON.stringify({
        is_whatsapp_send: true,
        recipient: "cenna",
        message: "aku ganteng",
      })
    );

    const result = await service.handleVoiceWhatsAppIntent(
      userId,
      "kriim ke wwwwwwwaaaaaaa cenna bilanggg aku ganteng",
      sessionId,
      operationId,
    );

    expect(hermes.generate).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.responseText).toContain("Siap! Pesan WhatsApp sudah dikirim ke cenna");
    expect(result.responseText).toContain("aku ganteng");
    expect(integrations.whatsappPreview).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        conversationId,
        message: "aku ganteng",
      })
    );
    expect(integrations.whatsappConfirm).toHaveBeenCalledWith(userId, "preview-123");
  });

  it("returns helpful message when contact is not found", async () => {
    const { service, hermes, integrations } = fixture({
      connected: true,
      hasContact: false,
    });

    const result = await service.handleVoiceWhatsAppIntent(
      userId,
      "kirim whatsapp ke non_existent_contact bilang halo",
      sessionId,
      operationId,
    );

    expect(result.handled).toBe(true);
    expect(result.responseText).toContain('Aku tidak menemukan kontak "non_existent_contact"');
    expect(integrations.whatsappPreview).not.toHaveBeenCalled();
    expect(hermes.generate).not.toHaveBeenCalled();
  });
});
