import { describe, expect, it, vi } from "vitest";
import {
  extractScheduleIntentWithHermes,
  formatJakartaReferenceTime,
} from "../../src/p9/services/schedule-nlu.js";
import type { HermesGenerateClient } from "../../src/services/hermes.client.js";

describe("formatJakartaReferenceTime", () => {
  it("formats Jakarta time (WIB, UTC+7) accurately", () => {
    // 2026-08-27T02:30:15.000Z -> 09:30:15 WIB, Kamis
    const nowUtc = new Date("2026-08-27T02:30:15.000Z");
    const ref = formatJakartaReferenceTime(nowUtc);

    expect(ref.iso).toBe("2026-08-27T02:30:15.000Z");
    expect(ref.wibDateStr).toBe("2026-08-27");
    expect(ref.wibTimeStr).toBe("09:30");
    expect(ref.dayOfWeek).toBe("Kamis");
    expect(ref.fullReference).toContain("Kamis, 27 Agustus 2026 pukul 09:30:15 WIB");
  });
});

describe("extractScheduleIntentWithHermes", () => {
  const baseNow = new Date("2026-08-27T02:00:00.000Z"); // 09:00 WIB

  it("returns null immediately for text shorter than 3 chars without calling Hermes", async () => {
    const hermes: HermesGenerateClient = {
      generate: vi.fn(),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "hi",
      now: baseNow,
    });

    expect(result).toBeNull();
    expect(hermes.generate).not.toHaveBeenCalled();
  });

  it("returns null if hermes client is missing or invalid", async () => {
    const result = await extractScheduleIntentWithHermes({
      hermes: null as unknown as HermesGenerateClient,
      text: "ingetin besok pagi jam 7",
      now: baseNow,
    });

    expect(result).toBeNull();
  });

  it("returns null when Hermes identifies input as not a schedule (is_schedule: false)", async () => {
    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(JSON.stringify({ is_schedule: false })),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "Siapa presiden pertama Indonesia?",
      now: baseNow,
    });

    expect(result).toBeNull();
    expect(hermes.generate).toHaveBeenCalled();
  });

  it("parses valid schedule extraction JSON from Hermes correctly", async () => {
    const dueAtIso = "2026-08-27T05:00:00.000Z"; // 12:00 WIB (+3 hours from 09:00 WIB)
    const hermesPayload = {
      is_schedule: true,
      prompt: "angkat jemuran",
      due_at: dueAtIso,
      exact_time: "12:00",
      date: "2026-08-27",
      frequency: "Once",
      time_label: "3 jam lagi",
    };

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(JSON.stringify(hermesPayload)),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "3 jam lagi tolong kabarin buat angkat jemuran ya",
      now: baseNow,
    });

    expect(result).not.toBeNull();
    expect(result?.prompt).toBe("angkat jemuran");
    expect(result?.dueAt.toISOString()).toBe(dueAtIso);
    expect(result?.exactTime).toBe("12:00");
    expect(result?.date).toBe("2026-08-27");
    expect(result?.frequency).toBe("Once");
    expect(result?.timeLabel).toBe("3 jam lagi");
  });

  it("extractScheduleIntentWithHermes parses elongated/typo reminder inputs accurately", async () => {
    const dueAtIso = "2026-08-27T02:01:00.000Z"; // 1 minute from 02:00:00 UTC
    const hermesPayload = {
      is_schedule: true,
      prompt: "minum kopi",
      due_at: dueAtIso,
      exact_time: "09:01",
      date: "2026-08-27",
      frequency: "Once",
      time_label: "1 menit lagi",
    };

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(JSON.stringify(hermesPayload)),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "ingetin 1mmmmeeeenit lagi buat minum kopi",
      now: baseNow,
    });

    expect(result).not.toBeNull();
    expect(result?.prompt).toBe("minum kopi");
    expect(result?.dueAt.toISOString()).toBe(dueAtIso);
    expect(result?.exactTime).toBe("09:01");
    expect(result?.date).toBe("2026-08-27");
    expect(result?.frequency).toBe("Once");
    expect(result?.timeLabel).toBe("1 menit lagi");
  });

  it("handles markdown code fences in Hermes output", async () => {
    const dueAtIso = "2026-08-28T00:00:00.000Z"; // Besok jam 07:00 WIB
    const rawOutput = `\`\`\`json
{
  "is_schedule": true,
  "prompt": "jogging santai",
  "due_at": "${dueAtIso}",
  "exact_time": "07:00",
  "date": "2026-08-28",
  "frequency": "Once",
  "time_label": "besok pagi jam 07.00"
}
\`\`\``;

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(rawOutput),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "Besok pagi jam 7 bangunin gua buat jogging santai ya",
      now: baseNow,
    });

    expect(result).not.toBeNull();
    expect(result?.prompt).toBe("jogging santai");
    expect(result?.dueAt.toISOString()).toBe(dueAtIso);
    expect(result?.exactTime).toBe("07:00");
    expect(result?.date).toBe("2026-08-28");
    expect(result?.frequency).toBe("Once");
  });

  it("supports Daily frequency for recurring schedules", async () => {
    const dueAtIso = "2026-08-28T00:00:00.000Z";
    const hermesPayload = {
      is_schedule: true,
      prompt: "minum vitamin",
      due_at: dueAtIso,
      exact_time: "07:00",
      date: "2026-08-28",
      frequency: "Daily",
      time_label: "setiap hari jam 07.00",
    };

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(JSON.stringify(hermesPayload)),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "Tiap pagi jam 7 ingetin gua minum vitamin",
      now: baseNow,
    });

    expect(result).not.toBeNull();
    expect(result?.frequency).toBe("Daily");
  });

  it("rejects timestamps that are in the past (< now + 30s)", async () => {
    // 5 minutes ago
    const pastIso = new Date(baseNow.getTime() - 5 * 60 * 1000).toISOString();
    const hermesPayload = {
      is_schedule: true,
      prompt: "telat bangun",
      due_at: pastIso,
      exact_time: "08:55",
      date: "2026-08-27",
      frequency: "Once",
      time_label: "jam 08.55",
    };

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(JSON.stringify(hermesPayload)),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "Ingetin jam 8.55 tadi",
      now: baseNow,
    });

    expect(result).toBeNull();
  });

  it("rejects timestamps too far in the future (> 1 year)", async () => {
    // 2 years from now
    const farFutureIso = new Date(baseNow.getTime() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const hermesPayload = {
      is_schedule: true,
      prompt: "dua tahun lagi",
      due_at: farFutureIso,
      exact_time: "09:00",
      date: "2028-08-27",
      frequency: "Once",
      time_label: "2 tahun lagi",
    };

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockResolvedValue(JSON.stringify(hermesPayload)),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "Ingetin 2 tahun lagi",
      now: baseNow,
    });

    expect(result).toBeNull();
  });

  it("returns null when Hermes throws or encounters a network error", async () => {
    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockRejectedValue(new Error("Connection reset by peer")),
    };

    const result = await extractScheduleIntentWithHermes({
      hermes,
      text: "Ingetin nanti sore jam 4 ada call",
      now: baseNow,
    });

    expect(result).toBeNull();
  });

  it("returns null when Hermes call exceeds timeout", async () => {
    let resolver: (val: string) => void = () => undefined;
    const promise = new Promise<string>((resolve) => {
      resolver = resolve;
    });
    const timer = setTimeout(() => resolver(JSON.stringify({ is_schedule: true })), 200);

    const hermes: HermesGenerateClient = {
      generate: vi.fn().mockImplementation(() => promise),
    };

    try {
      const result = await extractScheduleIntentWithHermes({
        hermes,
        text: "Ingetin lusa ada meeting",
        now: baseNow,
        timeoutMs: 50,
      });

      expect(result).toBeNull();
    } finally {
      clearTimeout(timer);
    }
  });
});
