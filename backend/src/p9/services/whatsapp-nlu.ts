import type { DetectedWhatsAppIntent } from "./whatsapp-intent.js";
import type { HermesGenerateClient } from "../../services/hermes.client.js";

export interface ExtractWhatsAppNluOptions {
  hermes: HermesGenerateClient;
  text: string;
  userId?: string;
  timeoutMs?: number;
}

export async function extractWhatsAppIntentWithHermes(
  options: ExtractWhatsAppNluOptions,
): Promise<DetectedWhatsAppIntent | null> {
  const trimmedText = options.text?.trim() ?? "";
  if (trimmedText.length < 3 || !options.hermes || typeof options.hermes.generate !== "function") {
    return null;
  }

  const instructions = `You are an intelligent semantic intent extraction engine for Joy, a personal AI companion with WhatsApp capabilities.
Analyze the user message (which may contain heavy typos, slang, informal Indonesian, abbreviations like 'japri'/'pc'/'dm'/'wa', or English) to determine if the user intends to send a WhatsApp message to someone.

If the user IS asking or intending to send a WhatsApp message or chat someone:
- Extract "recipient": the intended recipient contact name, group name, or nickname (e.g. "cenna", "Cenna Wijaya", "budi", "mama"). Strip any leading/trailing prepositions like "si", "ke", "kpd", "kepada", "dong".
- Extract "message": the core message content to send. Clean up leading filler verbs like "bilang", "bilangin", "katakan", "isinya", "bahwa", "kalo", "kalau", "mau bilang", "ucapin".
- Output ONLY valid JSON in this exact structure:
{
  "is_whatsapp_send": true,
  "recipient": "cenna",
  "message": "aku mau makan"
}

If the user message is NOT an instruction to send a message (e.g. asking a question, general chat, greeting):
Output ONLY valid JSON:
{
  "is_whatsapp_send": false
}

Do not include markdown fences, code blocks, explanations, or any extra text. Output ONLY the JSON object.`;

  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("WhatsApp NLU extraction timeout"));
    }, timeoutMs);
  });

  let rawOutput: string;
  try {
    rawOutput = await Promise.race([
      options.hermes.generate(trimmedText, controller.signal, {
        conversation: `whatsapp-nlu:${options.userId ?? "anonymous"}`,
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

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed && typeof parsed === "object" && parsed.is_whatsapp_send === true) {
      if (typeof parsed.recipient === "string" && typeof parsed.message === "string") {
        const recipient = parsed.recipient.trim();
        const message = parsed.message.trim();
        if (recipient.length > 0 && message.length > 0) {
          return { recipient, message };
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}
