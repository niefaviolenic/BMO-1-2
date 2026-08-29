import {
  validateScheduleResult,
  type ScheduleResultValidation,
} from "./schedule-result.validation.js";
import type {
  DeviceSpeechPort,
  DeviceSpeechOutcome,
} from "../device-speech.port.js";
import type { ChatMessage, ScheduleRun } from "../generated/prisma/client.js";

export interface HermesScheduleResultGenerator {
  generate(input: { system: string; prompt: string }): Promise<string>;
}

export interface ScheduledResultRepository {
  persistSuccess(input: {
    runId: string;
    userId: string;
    content: string;
    targetSessionId?: string | null;
  }): Promise<{ message: ChatMessage; run: ScheduleRun }>;
  markFailed(runId: string, reason: string): Promise<void>;
}

export interface PushNotificationsEmitter {  sendToUser(userId: string, payload: {    title: string;    body: string;    data?: Record<string, unknown>;    sound?: string;    priority?: "default" | "normal" | "high";    channelId?: string;  }): Promise<unknown>;}export interface MobileEventsEmitter {
  emitBestEffort(userId: string, event: unknown): Promise<void>;
}

export type ScheduledResultOutcome =
  | { ok: true; message: ChatMessage; speech: DeviceSpeechOutcome }
  | { ok: false; reason: string };

export interface ClaimedScheduleRun {
  id: string;
  scheduleId: string;
  userId: string;
  targetDeviceId: string | null;
  status: "CLAIMED";
  dueAt: Date;
  payload: { prompt?: string; title?: string; text?: string; sessionId?: string } | unknown;
}

const SYSTEM_PROMPT =
  "Write the spoken result for this schedule. Return exactly 2-10 Unicode words, one line, no markup.";

export function buildSchedulePrompt(run: ClaimedScheduleRun): string {
  const payload = (run.payload ?? {}) as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title : "Schedule";
  const prompt =
    typeof payload.prompt === "string"
      ? payload.prompt
      : typeof payload.text === "string"
      ? payload.text
      : "";
  return `Schedule title: ${title}. ${prompt ? `Details: ${prompt}` : ""}`.trim();
}

export class ScheduledResultService {
  constructor(
    private readonly hermes: HermesScheduleResultGenerator,
    private readonly repository: ScheduledResultRepository,
    private readonly mobileEvents: MobileEventsEmitter,
    private readonly deviceSpeech?: DeviceSpeechPort,    private readonly pushNotifications?: PushNotificationsEmitter,
  ) {}

  async completeClaimedRun(
    run: ClaimedScheduleRun,
  ): Promise<ScheduledResultOutcome> {
    if (run.status !== "CLAIMED") throw new Error("schedule run must be CLAIMED");

    let checkedText = "Waktunya pengingat kamu sekarang ya!";
    try {
      const first = await this.hermes.generate({
        system: SYSTEM_PROMPT,
        prompt: buildSchedulePrompt(run),
      });
      const checked = validateScheduleResult(first);
      if (checked.valid) {
        checkedText = checked.value;
      } else {
        const repaired = await this.hermes.generate({
          system: SYSTEM_PROMPT,
          prompt: `Repair this output to 2-10 words: ${first}`,
        });
        const repairedCheck = validateScheduleResult(repaired);
        if (repairedCheck.valid) {
          checkedText = repairedCheck.value;
        } else {
          const payload = (run.payload ?? {}) as Record<string, unknown>;
          const title =
            typeof payload.title === "string"
              ? payload.title.slice(0, 30).trim()
              : "cek jadwal";
          const fallback = `Saatnya untuk ${title}!`;
          const fallbackCheck = validateScheduleResult(fallback);
          if (fallbackCheck.valid) {
            checkedText = fallbackCheck.value;
          } else {
            checkedText = "Waktunya pengingat kamu sekarang ya!";
          }
        }
      }
    } catch {
      checkedText = "Waktunya pengingat kamu sekarang ya!";
    }

    const payloadObj = (run.payload ?? {}) as Record<string, unknown>;
    const targetSessionId =
      typeof payloadObj.sessionId === "string" && payloadObj.sessionId.length > 0
        ? payloadObj.sessionId
        : null;

    let persisted: { message: ChatMessage; run: ScheduleRun };
    try {
      persisted = await this.repository.persistSuccess({
        runId: run.id,
        userId: run.userId,
        content: checkedText,
        targetSessionId,
      });
    } catch (error) {
      await this.repository.markFailed(run.id, "schedule_persistence_failed");
      return { ok: false, reason: "schedule_persistence_failed" };
    }

    const createdAtStr = persisted.message.createdAt
      ? typeof persisted.message.createdAt === "string"
        ? persisted.message.createdAt
        : persisted.message.createdAt.toISOString()
      : new Date().toISOString();

    // Best-effort mobile event emission
    await this.mobileEvents.emitBestEffort(run.userId, {
      event: "notification",
      id: persisted.message.id,
      type: "GENERIC",
      title: "Joy Schedule",
      body: persisted.message.content,
      createdAt: createdAtStr,
    });

    await this.mobileEvents.emitBestEffort(run.userId, {
      event: "chat_message",
      sessionId: persisted.message.sessionId,
      message: {
        id: persisted.message.id,
        sender: "assistant",
        text: persisted.message.content,
        sourceDeviceId: null,
        createdAt: createdAtStr,
      },
    });

    if (this.pushNotifications) {      void this.pushNotifications.sendToUser(run.userId, {        title: "Joy Schedule",        body: persisted.message.content,        data: {          type: "schedule",          scheduleId: run.scheduleId,          sessionId: persisted.message.sessionId,          messageId: persisted.message.id,        },      }).catch(() => undefined);    }    let speech: DeviceSpeechOutcome = { status: "MISSED", reason: "OFFLINE" };
    if (run.targetDeviceId && this.deviceSpeech) {
      try {
        speech = await this.deviceSpeech.deliverScheduleOnce({
          userId: run.userId,
          deviceId: run.targetDeviceId,
          scheduleRunId: run.id,
          assistantMessageId: persisted.message.id,
          text: persisted.message.content,
        });
      } catch (speechError) {
        speech = { status: "FAILED", reason: "DELIVERY_ERROR" };
      }
    }

    return { ok: true, message: persisted.message, speech };
  }
}
