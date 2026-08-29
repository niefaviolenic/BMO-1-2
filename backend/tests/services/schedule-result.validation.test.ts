import { describe, expect, it } from "vitest";
import { validateScheduleResult } from "../../src/services/schedule-result.validation.js";

describe("validateScheduleResult", () => {
  it("accepts 2-10 Unicode words with valid terminal punctuation", () => {
    expect(validateScheduleResult("Waktunya minum air!")).toEqual({
      valid: true,
      value: "Waktunya minum air!",
      wordCount: 3,
    });
    expect(validateScheduleResult("Saatnya meeting dengan tim desain.")).toEqual({
      valid: true,
      value: "Saatnya meeting dengan tim desain.",
      wordCount: 5,
    });
  });

  it("rejects empty or whitespace-only input", () => {
    expect(validateScheduleResult("")).toEqual({ valid: false, reason: "empty" });
    expect(validateScheduleResult("   \t  ")).toEqual({ valid: false, reason: "empty" });
  });

  it("rejects multiline input", () => {
    expect(validateScheduleResult("Halo ini baris satu\ndan ini baris dua")).toEqual({
      valid: false,
      reason: "multiline",
    });
  });

  it("rejects word count less than 2 or greater than 10", () => {
    expect(validateScheduleResult("Halo")).toEqual({
      valid: false,
      reason: "word_count",
    });
    expect(
      validateScheduleResult(
        "Satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas",
      ),
    ).toEqual({
      valid: false,
      reason: "word_count",
    });
  });
});
