import { describe, expect, it, vi } from "vitest";
import {
  extractActionIntentWithHermes,
  resolveActionIntent,
} from "../../src/p9/services/action-nlu.js";
import { detectFastPathActionIntent, hasActionCue } from "../../src/p9/services/action-intent.js";

describe("Unified Action Intent - Fast Path & NLU", () => {
  describe("detectFastPathActionIntent", () => {
    it("matches standard WhatsApp command on fast-path", () => {
      const result = detectFastPathActionIntent("kirim whatsapp ke cenna bilang aku sudah sampai");
      expect(result).toEqual({
        action: "SEND_WHATSAPP",
        recipient: "cenna",
        message: "aku sudah sampai",
      });
    });

    it("matches fast-path Spotify controls (PLAY, PAUSE, RESUME, NEXT, PREVIOUS)", () => {
      expect(detectFastPathActionIntent("play bohemian rhapsody")).toEqual({
        action: "SPOTIFY_CONTROL",
        subAction: "PLAY",
        query: "bohemian rhapsody",
      });

      expect(detectFastPathActionIntent("pause lagu")).toEqual({
        action: "SPOTIFY_CONTROL",
        subAction: "PAUSE",
      });

      expect(detectFastPathActionIntent("lanjutkan musik")).toEqual({
        action: "SPOTIFY_CONTROL",
        subAction: "RESUME",
      });

      expect(detectFastPathActionIntent("skip")).toEqual({
        action: "SPOTIFY_CONTROL",
        subAction: "NEXT",
      });

      expect(detectFastPathActionIntent("lagu sebelumnya")).toEqual({
        action: "SPOTIFY_CONTROL",
        subAction: "PREVIOUS",
      });
    });

    it("returns null for non-regex / slang / informal commands so they fall through to AI NLU", () => {
      expect(detectFastPathActionIntent("blg ke cenna w mau pulang sumpah demi anjir")).toBeNull();
      expect(detectFastPathActionIntent("whhhwwwatsapppp ke cenna ak mau mammmmm")).toBeNull();
      expect(detectFastPathActionIntent("puterin lagu komang dong")).toBeNull();
      expect(detectFastPathActionIntent("ingetin 5 menit lagi angkat jemuran")).toBeNull();
      expect(detectFastPathActionIntent("lu tau nomor cenna ga")).toBeNull();
      expect(detectFastPathActionIntent("halo joy apa kabar")).toBeNull();
    });
  });

  describe("hasActionCue", () => {
    it("identifies action cues in slang and typo messages", () => {
      expect(hasActionCue("blg ke cenna w mau pulang sumpah demi anjir")).toBe(true);
      expect(hasActionCue("whhhwwwatsapppp ke cenna ak mau mammmmm")).toBe(true);
      expect(hasActionCue("puterin lagu komang dong")).toBe(true);
      expect(hasActionCue("ingetin 5 menit lagi angkat jemuran")).toBe(true);
      expect(hasActionCue("japri budi")).toBe(true);
      expect(hasActionCue("setel musik tulus")).toBe(true);
      expect(hasActionCue("laut ddari bernadya")).toBe(true);
      expect(hasActionCue("dengerin juicy luicy")).toBe(true);
      expect(hasActionCue("pesan untuk riri", [{ name: "riri" }])).toBe(true);
    });

    it("returns false for pure conversational messages without action keywords", () => {
      expect(hasActionCue("What should we do?")).toBe(false);
      expect(hasActionCue("Call me Finn.")).toBe(false);
      expect(hasActionCue("Halo BMO!")).toBe(false);
      expect(hasActionCue("Siapa presiden pertama Indonesia?")).toBe(false);
    });
  });

  describe("extractActionIntentWithHermes & resolveActionIntent", () => {
    it("extracts WhatsApp intent with slang and typos via Hermes NLU", async () => {
      const hermes = {
        generate: vi.fn().mockResolvedValue(
          JSON.stringify({
            action: "send_whatsapp",
            recipient: "cenna",
            message: "w mau pulang sumpah demi anjir",
          }),
        ),
      };

      const result = await resolveActionIntent({
        hermes: hermes as any,
        text: "blg ke cenna w mau pulang sumpah demi anjir",
        contacts: [{ name: "cenna", phoneNumber: "+628123456789" }],
      });

      expect(hermes.generate).toHaveBeenCalled();
      expect(result).toEqual({
        action: "SEND_WHATSAPP",
        recipient: "cenna",
        message: "w mau pulang sumpah demi anjir",
      });
    });

    it("extracts Spotify control with query via Hermes NLU", async () => {
      const hermes = {
        generate: vi.fn().mockResolvedValue(
          JSON.stringify({
            action: "control_spotify",
            sub_action: "PLAY",
            query: "komang",
          }),
        ),
      };

      const result = await resolveActionIntent({
        hermes: hermes as any,
        text: "puterin lagu komang dong",
      });

      expect(hermes.generate).toHaveBeenCalled();
      expect(result).toEqual({
        action: "SPOTIFY_CONTROL",
        subAction: "PLAY",
        query: "komang",
      });
    });

    it("extracts Schedule creation intent via Hermes NLU with calculated future date", async () => {
      const dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const hermes = {
        generate: vi.fn().mockResolvedValue(
          JSON.stringify({
            action: "create_schedule",
            prompt: "angkat jemuran",
            due_at: dueAt,
            exact_time: "14:30",
            date: "2026-08-29",
            frequency: "Once",
            time_label: "10 menit lagi",
          }),
        ),
      };

      const result = await resolveActionIntent({
        hermes: hermes as any,
        text: "ingetin 10 menit lagi angkat jemuran",
      });

      expect(hermes.generate).toHaveBeenCalled();
      expect(result.action).toBe("CREATE_SCHEDULE");
      if (result.action === "CREATE_SCHEDULE") {
        expect(result.prompt).toBe("angkat jemuran");
        expect(result.timeLabel).toBe("10 menit lagi");
        expect(result.exactTime).toBe("14:30");
        expect(result.frequency).toBe("Once");
      }
    });

    it("classifies informational query or non-action as NONE via extractActionIntentWithHermes", async () => {
      const hermes = {
        generate: vi.fn().mockResolvedValue(
          JSON.stringify({
            action: "none",
          }),
        ),
      };

      const result = await extractActionIntentWithHermes({
        hermes: hermes as any,
        text: "lu tau nomor cenna ga",
        contacts: [{ name: "cenna", phoneNumber: "+628123456789" }],
      });

      expect(hermes.generate).toHaveBeenCalled();
      expect(result).toEqual({ action: "NONE" });
    });

    it("resolves non-cue message to NONE without invoking Hermes LLM call", async () => {
      const hermes = {
        generate: vi.fn(),
      };

      const result = await resolveActionIntent({
        hermes: hermes as any,
        text: "halo joy apa kabar",
      });

      expect(hermes.generate).not.toHaveBeenCalled();
      expect(result).toEqual({ action: "NONE" });
    });

    it("resilience: gracefully falls back to action: NONE on timeout or JSON parse error", async () => {
      const hermesTimeout = {
        generate: vi.fn().mockRejectedValue(new Error("Timeout")),
      };

      const resultTimeout = await resolveActionIntent({
        hermes: hermesTimeout as any,
        text: "kirim pesan ke cenna",
      });
      expect(resultTimeout).toEqual({ action: "NONE" });

      const hermesInvalidJson = {
        generate: vi.fn().mockResolvedValue("Sorry, I am not sure what you mean."),
      };

      const resultInvalid = await resolveActionIntent({
        hermes: hermesInvalidJson as any,
        text: "kirim pesan ke cenna",
      });
      expect(resultInvalid).toEqual({ action: "NONE" });
    });
  });
});
