import type { DetectedScheduleIntent } from "./schedule-intent.js";
import type { HermesGenerateClient } from "../../services/hermes.client.js";

const JAKARTA_OFFSET_HOURS = 7;
const JAKARTA_OFFSET_MS = JAKARTA_OFFSET_HOURS * 60 * 60 * 1000;

export interface ExtractScheduleNluOptions {
  hermes: HermesGenerateClient;
  text: string;
  userId?: string;
  now?: Date;
  timeoutMs?: number;
}

const INDONESIAN_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatJakartaReferenceTime(now: Date): {
  iso: string;
  wibDateStr: string;
  wibTimeStr: string;
  dayOfWeek: string;
  fullReference: string;
} {
  const nowJakarta = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const year = nowJakarta.getUTCFullYear();
  const month = nowJakarta.getUTCMonth();
  const date = nowJakarta.getUTCDate();
  const day = nowJakarta.getUTCDay();
  const hours = nowJakarta.getUTCHours();
  const minutes = nowJakarta.getUTCMinutes();
  const seconds = nowJakarta.getUTCSeconds();

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${year}-${pad(month + 1)}-${pad(date)}`;
  const timeStr = `${pad(hours)}:${pad(minutes)}`;
  const dayOfWeek = INDONESIAN_DAYS[day] ?? "";
  const monthName = INDONESIAN_MONTHS[month] ?? "";
  const fullReference = `${dayOfWeek}, ${date} ${monthName} ${year} pukul ${timeStr}:${pad(seconds)} WIB (UTC+7, ISO UTC: ${now.toISOString()})`;

  return {
    iso: now.toISOString(),
    wibDateStr: dateStr,
    wibTimeStr: timeStr,
    dayOfWeek,
    fullReference,
  };
}

export async function extractScheduleIntentWithHermes(
  options: ExtractScheduleNluOptions,
): Promise<DetectedScheduleIntent | null> {
  const trimmedText = options.text?.trim() ?? "";
  if (trimmedText.length < 3 || !options.hermes || typeof options.hermes.generate !== "function") {
    return null;
  }

  const now = options.now ?? new Date();
  const refTime = formatJakartaReferenceTime(now);

  const instructions = `You are an intelligent schedule, reminder, and alarm extraction NLU for Joy, a personal AI companion.
Analyze the user message (in Indonesian or English) to determine if the user intends to create a reminder, alarm, or schedule.

Current reference time in WIB (Asia/Jakarta, UTC+7):
- Full Reference: ${refTime.fullReference}
- Current Date (WIB): ${refTime.wibDateStr} (${refTime.dayOfWeek})
- Current Time (WIB): ${refTime.wibTimeStr}

If the user IS asking to set a reminder, alarm, or schedule:
- Calculate "due_at" as an exact ISO 8601 UTC timestamp string (e.g. "2026-08-27T04:00:00.000Z"). Note: WIB is UTC+7 (09:00 WIB = 02:00 UTC).
- Calculate relative times from current time (e.g., "1mmenit lagi" / "1 menit lagi" = now + 1 minute, "3 jam lagi" = now + 3 hours, "besok jam 7 pagi" = tomorrow at 07:00 WIB, "lusa jam 10" = 2 days from now at 10:00 WIB, "nanti sore jam 4" = today at 16:00 WIB, "nanti malam jam 8" = today at 20:00 WIB).
- If a time earlier today is mentioned without a date (e.g. asking for 6 AM when current time is 09:00 WIB), assume tomorrow at that time.
- Extract the core task/event as "prompt" (e.g. "makan siang", "meeting dengan tim", "minum obat", "angkat jemuran"). Strip conversational fillers, greetings, and reminder verbs ("ingetin", "jadwalkan", "tolong", "dong", "ya", "kabarin", "bangunin", "pasang alarm").
- "exact_time": "HH:mm" in WIB 24h format (e.g. "07:00", "16:30").
- "date": "YYYY-MM-DD" of occurrence in WIB.
- "frequency": "Daily" if user explicitly specified recurring/every day/setiap hari/tiap pagi, otherwise "Once".
- "time_label": concise human-friendly Indonesian time label (e.g. "jam 07.00 besok", "1 menit lagi", "3 jam lagi", "nanti sore jam 16.00", "jam 10.00").
- Output ONLY valid JSON in this exact structure:
{
  "is_schedule": true,
  "prompt": "meeting penting",
  "due_at": "2026-08-27T04:00:00.000Z",
  "exact_time": "11:00",
  "date": "2026-08-27",
  "frequency": "Once",
  "time_label": "jam 11.00"
}

If the user message is NOT a schedule, reminder, or alarm request:
Output ONLY valid JSON:
{
  "is_schedule": false
}

Do not include markdown fences, code blocks, explanations, or any extra text. Output ONLY the JSON object.`;

  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Schedule NLU extraction timeout"));
    }, timeoutMs);
  });

  let rawOutput: string;
  try {
    rawOutput = await Promise.race([
      options.hermes.generate(trimmedText, controller.signal, {
        conversation: `schedule-nlu:${options.userId ?? "anonymous"}`,
        ...(options.userId ? { sessionKey: `joy:user:${options.userId}` } : {}),
        instructions,
        raw: true,
      }),
      deadline,
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (typeof rawOutput !== "string" || !rawOutput.trim()) {
    return null;
  }

  const cleaned = rawOutput
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || parsed.is_schedule !== true) {
    return null;
  }

  if (typeof parsed.due_at !== "string" || !parsed.due_at.trim()) {
    return null;
  }

  const dueAt = new Date(parsed.due_at.trim());
  if (isNaN(dueAt.getTime())) {
    return null;
  }

  const nowMs = now.getTime();
  const dueAtMs = dueAt.getTime();
  const minFutureMs = nowMs + 30_000; // at least 30s in the future
  const maxFutureMs = nowMs + 366 * 24 * 60 * 60 * 1000; // at most 1 year ahead

  if (dueAtMs < minFutureMs || dueAtMs > maxFutureMs) {
    return null;
  }

  const dueJakarta = new Date(dueAt.getTime() + JAKARTA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");

  const dateStr = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
    ? parsed.date.trim()
    : `${dueJakarta.getUTCFullYear()}-${pad(dueJakarta.getUTCMonth() + 1)}-${pad(dueJakarta.getUTCDate())}`;

  let exactTimeStr = typeof parsed.exact_time === "string" && /^\d{1,2}:\d{2}$/.test(parsed.exact_time.trim())
    ? parsed.exact_time.trim()
    : `${pad(dueJakarta.getUTCHours())}:${pad(dueJakarta.getUTCMinutes())}`;

  if (exactTimeStr.length === 4) {
    exactTimeStr = "0" + exactTimeStr;
  }

  const promptStr = typeof parsed.prompt === "string" && parsed.prompt.trim().length > 0
    ? parsed.prompt.trim()
    : "Pengingat dari Joy";

  const timeLabelStr = typeof parsed.time_label === "string" && parsed.time_label.trim().length > 0
    ? parsed.time_label.trim()
    : `jam ${exactTimeStr.replace(":", ".")}`;

  const frequency: "Once" | "Daily" = parsed.frequency === "Daily" ? "Daily" : "Once";

  return {
    prompt: promptStr,
    dueAt,
    frequency,
    exactTime: exactTimeStr,
    date: dateStr,
    timeLabel: timeLabelStr,
  };
}
