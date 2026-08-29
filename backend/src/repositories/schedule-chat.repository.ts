import {
  ChatMessageRole,
  ChatSessionPurpose,
  type PrismaClient,
} from "../generated/prisma/client.js";

export class ScheduleChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendRunResult(input: {
    userId: string;
    scheduleRunId: string;
    content: string;
    targetSessionId?: string | null | undefined;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${'joy-schedule-chat:' + input.userId}, 0)
        )
      `;

      const run = await tx.scheduleRun.findFirstOrThrow({
        where: { id: input.scheduleRunId, schedule: { userId: input.userId } },
        select: { id: true, scheduleId: true },
      });

      const existing = await tx.chatMessage.findUnique({
        where: { scheduleRunId: run.id },
      });
      if (existing) return existing;

      // Determine the session to use: prioritize targetSessionId, then latest active USER_CHAT, then JOY_SCHEDULE
      let targetSession: { id: string } | null = null;
      if (input.targetSessionId) {
        targetSession = await tx.chatSession.findFirst({
          where: { id: input.targetSessionId, userId: input.userId, status: "ACTIVE", deletedAt: null },
          select: { id: true },
        });
      }

      if (!targetSession) {
        targetSession = await tx.chatSession.findFirst({
          where: { userId: input.userId, status: "ACTIVE", deletedAt: null },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
      }

      let session = targetSession;
      if (!session) {
        session = await tx.chatSession.create({
          data: {
            userId: input.userId,
            purpose: ChatSessionPurpose.JOY_SCHEDULE,
            title: "Joy Schedule",
          },
          select: { id: true },
        });
      }

      return tx.chatMessage.create({
        data: {
          sessionId: session.id,
          userId: input.userId,
          scheduleRunId: run.id,
          role: ChatMessageRole.ASSISTANT,
          content: input.content,
        },
      });
    });
  }
}
