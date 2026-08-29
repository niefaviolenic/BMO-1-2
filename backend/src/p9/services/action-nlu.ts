import type { HermesGenerateClient } from "../../services/hermes.client.js";
import { formatJakartaReferenceTime } from "./schedule-nlu.js";
import { detectFastPathActionIntent, hasActionCue, type UnifiedActionIntent } from "./action-intent.js";

export type { UnifiedActionIntent } from "./action-intent.js";
export { hasActionCue } from "./action-intent.js";

const JAKARTA_OFFSET_HOURS = 7;
const JAKARTA_OFFSET_MS = JAKARTA_OFFSET_HOURS * 60 * 60 * 1000;

export interface ContactInfo {
  name: string;
  phoneNumber?: string;
  type?: string;
}

export interface ResolveActionIntentOptions {
  hermes?: HermesGenerateClient;
  text: string;
  userId?: string;
  now?: Date;
  contacts?: ContactInfo[];
  timeoutMs?: number;
}

export async function extractActionIntentWithHermes(
  options: ResolveActionIntentOptions,
): Promise<UnifiedActionIntent> {
  const trimmedText = options.text?.trim() ?? "";
  if (trimmedText.length < 2 || !options.hermes || typeof options.hermes.generate !== "function") {
    return { action: "NONE" };
  }

  const now = options.now ?? new Date();
  const refTime = formatJakartaReferenceTime(now);

  const contactListStr =
    options.contacts && options.contacts.length > 0
      ? options.contacts
          .map((c) => `- ${c.name}${c.phoneNumber ? ` (${c.phoneNumber})` : ""}`)
          .join("\n")
      : "No contacts available.";

  const instructions = `You are an intelligent unified semantic action routing engine for Joy, a personal AI companion.
Analyze the user message (which may contain slang, heavy typos, abbreviations like 'japri'/'pc'/'wa'/'blg', Indonesian, English, or mix) and classify user intent into a structured JSON action.

Available Contacts on WhatsApp:
${contactListStr}

Current reference time in WIB (Asia/Jakarta, UTC+7):
- Full Reference: ${refTime.fullReference}
- Current Date (WIB): ${refTime.wibDateStr} (${refTime.dayOfWeek})
- Current Time (WIB): ${refTime.wibTimeStr}

Actions you can classify:
1. "send_whatsapp":
- When user intends to send a WhatsApp message, chat, text, or notify someone (e.g. "blg ke cenna w mau pulang", "whhhwwwatsapppp ke cenna ak mau mam", "pc budi besok jadi ga").
- "recipient": The target contact name or recipient (e.g. "cenna", "budi", "mama"). Match against Available Contacts if possible.
- "message": The message body. Strip filler verbs ("bilang", "bilangin", "katakan", "isinya", "bahwa", "kalo", "kalau", "mau", "pesan").
- JSON format:
{
  "action": "send_whatsapp",
  "recipient": "cenna",
  "message": "w mau pulang"
}

2. "control_spotify":
- When user intends to play, pause, resume, skip, or control music playback (e.g. "setel lagu komang", "puterin tulus", "laut ddari bernadya", "lagu sepatu tulus", "skip", "pause lagu").
- "sub_action": one of "PLAY", "PAUSE", "RESUME", "NEXT", "PREVIOUS".
- "query": Required if sub_action is "PLAY". The song title, artist, or album to play (e.g. "komang", "tulus", "laut dari bernadya"). Fix obvious typos in the query.
- JSON format:
{
  "action": "control_spotify",
  "sub_action": "PLAY",
  "query": "komang"
}
or:
{
  "action": "control_spotify",
  "sub_action": "PAUSE"
}

3. "create_schedule":
- When user intends to set a reminder, alarm, or schedule an event (e.g. "ingetin 10 menit lagi angkat jemuran", "jadwalin besok jam 8 pagi meeting").
- "prompt": The core reminder task (e.g. "angkat jemuran", "meeting", "minum obat"). Strip conversational fillers and relative time prefixes.
- "due_at": Exact ISO 8601 UTC timestamp string (e.g. "2026-08-27T04:00:00.000Z"). WIB is UTC+7.
- "exact_time": "HH:mm" in WIB 24h format (e.g. "08:00", "14:30").
- "date": "YYYY-MM-DD" of occurrence in WIB.
- "frequency": "Daily" if user explicitly specified recurring/daily/setiap hari/tiap pagi, otherwise "Once".
- "time_label": Human-friendly Indonesian time label (e.g. "10 menit lagi", "jam 08.00 besok", "1 jam lagi").
- JSON format:
{
  "action": "create_schedule",
  "prompt": "angkat jemuran",
  "due_at": "2026-08-27T04:10:00.000Z",
  "exact_time": "11:10",
  "date": "2026-08-27",
  "frequency": "Once",
  "time_label": "10 menit lagi"
}

4. "none":
- When user is asking an informational question, querying a contact's info without sending a message, greeting, or general conversation.
- JSON format:
{
  "action": "none"
}

Do not include markdown code fences, backticks, explanations, or any extra text. Output ONLY the raw JSON object.`;

  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Unified action NLU extraction timed out"));
    }, timeoutMs);
  });

  let rawOutput: string;
  try {
    rawOutput = await Promise.race([
      options.hermes.generate(trimmedText, controller.signal, {
        instructions,
        conversation: `nlu:action:${options.userId ?? "default"}`,
        sessionKey: `nlu:action:${options.userId ?? "default"}`,
        raw: true,
      }),
      deadline,
    ]);
  } catch {
    return { action: "NONE" };
  } finally {
    if (timer) clearTimeout(timer);
  }

  let cleaned = (rawOutput ?? "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return { action: "NONE" };
      }
    } else {
      return { action: "NONE" };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { action: "NONE" };
  }

  const actionType = typeof parsed.action === "string" ? parsed.action.toLowerCase() : "";

  // 1. send_whatsapp
  if (actionType === "send_whatsapp" || actionType === "whatsapp_send" || parsed.is_whatsapp === true) {
    const recipient = typeof parsed.recipient === "string" ? parsed.recipient.trim() : "";
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (recipient.length > 0 && message.length > 0) {
      return {
        action: "SEND_WHATSAPP",
        recipient,
        message,
      };
    }
  }

  // 2. control_spotify
  if (actionType === "control_spotify" || actionType === "spotify_control" || parsed.is_spotify === true) {
    const rawSubAction = typeof parsed.sub_action === "string" ? parsed.sub_action.toUpperCase() : "PLAY";
    if (rawSubAction === "PLAY") {
      const query = typeof parsed.query === "string" ? parsed.query.trim() : "";
      if (query.length > 0) {
        return {
          action: "SPOTIFY_CONTROL",
          subAction: "PLAY",
          query,
        };
      }
    } else if (
      rawSubAction === "PAUSE" ||
      rawSubAction === "RESUME" ||
      rawSubAction === "NEXT" ||
      rawSubAction === "PREVIOUS"
    ) {
      return {
        action: "SPOTIFY_CONTROL",
        subAction: rawSubAction as "PAUSE" | "RESUME" | "NEXT" | "PREVIOUS",
      };
    }
  }

  // 3. create_schedule
  if (actionType === "create_schedule" || actionType === "schedule_create" || parsed.is_schedule === true) {
    if (typeof parsed.due_at === "string" && parsed.due_at.trim()) {
      const dueAt = new Date(parsed.due_at.trim());
      if (!isNaN(dueAt.getTime())) {
        const nowMs = now.getTime();
        const dueAtMs = dueAt.getTime();
        const minFutureMs = nowMs + 30_000;
        const maxFutureMs = nowMs + 366 * 24 * 60 * 60 * 1000;
        if (dueAtMs >= minFutureMs && dueAtMs <= maxFutureMs) {
          const dueJakarta = new Date(dueAt.getTime() + JAKARTA_OFFSET_MS);
          const pad = (n: number) => String(n).padStart(2, "0");
          const dateStr =
            typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
              ? parsed.date.trim()
              : `${dueJakarta.getUTCFullYear()}-${pad(dueJakarta.getUTCMonth() + 1)}-${pad(dueJakarta.getUTCDate())}`;
          let exactTimeStr =
            typeof parsed.exact_time === "string" && /^\d{1,2}:\d{2}$/.test(parsed.exact_time.trim())
              ? parsed.exact_time.trim()
              : `${pad(dueJakarta.getUTCHours())}:${pad(dueJakarta.getUTCMinutes())}`;
          if (exactTimeStr.length === 4) {
            exactTimeStr = "0" + exactTimeStr;
          }
          const promptStr =
            typeof parsed.prompt === "string" && parsed.prompt.trim().length > 0
              ? parsed.prompt.trim()
              : "Pengingat dari Joy";
          const timeLabelStr =
            typeof parsed.time_label === "string" && parsed.time_label.trim().length > 0
              ? parsed.time_label.trim()
              : `jam ${exactTimeStr.replace(":", ".")}`;
          const frequency: "Once" | "Daily" = parsed.frequency === "Daily" ? "Daily" : "Once";

          return {
            action: "CREATE_SCHEDULE",
            prompt: promptStr,
            dueAt,
            exactTime: exactTimeStr,
            date: dateStr,
            frequency,
            timeLabel: timeLabelStr,
          };
        }
      }
    }
  }

  return { action: "NONE" };
}

export async function resolveActionIntent(
  options: ResolveActionIntentOptions,
): Promise<UnifiedActionIntent> {
  const trimmed = options.text?.trim() ?? "";
  if (trimmed.length < 2) {
    return { action: "NONE" };
  }

  // 1. Fast path lexical shortcut
  const fastPath = detectFastPathActionIntent(trimmed);
  if (fastPath) {
    return fastPath;
  }

  // 2. If text contains no action cues and no contacts match, skip extra LLM call
  if (!hasActionCue(trimmed, options.contacts)) {
    return { action: "NONE" };
  }

  // 3. Fall back to Hermes Unified NLU extraction
  if (options.hermes && typeof options.hermes.generate === "function") {
    return extractActionIntentWithHermes(options);
  }

  return { action: "NONE" };
}
