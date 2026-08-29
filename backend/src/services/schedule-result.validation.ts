const WORD = /^[\p{L}\p{M}\p{N}]+(?:['’\-‐][\p{L}\p{M}\p{N}]+)*$/u;
const FINAL_WORD = /^[\p{L}\p{M}\p{N}]+(?:['’\-‐][\p{L}\p{M}\p{N}]+)*[.!?…]?$/u;

export type ScheduleResultValidation =
  | { valid: true; value: string; wordCount: number }
  | { valid: false; reason: "empty" | "multiline" | "word_count" | "token" };

export function validateScheduleResult(input: string): ScheduleResultValidation {
  const normalized = input.normalize("NFC").trim();
  if (!normalized) return { valid: false, reason: "empty" };
  if (/[\r\n]/u.test(normalized)) return { valid: false, reason: "multiline" };
  const words = normalized.split(/\p{White_Space}+/u);
  if (words.length < 2 || words.length > 10) {
    return { valid: false, reason: "word_count" };
  }
  const tokensValid = words.every((word, index) =>
    (index === words.length - 1 ? FINAL_WORD : WORD).test(word),
  );
  if (!tokensValid) return { valid: false, reason: "token" };
  return { valid: true, value: words.join(" "), wordCount: words.length };
}
