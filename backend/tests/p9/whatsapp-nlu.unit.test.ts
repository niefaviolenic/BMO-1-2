import { describe, expect, it, vi } from "vitest";
import { extractWhatsAppIntentWithHermes } from "../../src/p9/services/whatsapp-nlu.js";

describe("extractWhatsAppIntentWithHermes", () => {
  it("extracts recipient and message from slang / typos via Hermes NLU", async () => {
    const hermes = {
      generate: vi.fn().mockResolvedValue(
        JSON.stringify({
          is_whatsapp_send: true,
          recipient: "cenna",
          message: "aku ganteng",
        })
      ),
    };

    const result = await extractWhatsAppIntentWithHermes({
      hermes,
      text: "kriim ke wwwwwwwaaaaaaa cenna bilanggg aku ganteng",
      userId: "user-123",
    });

    expect(hermes.generate).toHaveBeenCalled();
    expect(result).toEqual({
      recipient: "cenna",
      message: "aku ganteng",
    });
  });

  it("returns null when Hermes indicates is_whatsapp_send: false", async () => {
    const hermes = {
      generate: vi.fn().mockResolvedValue(
        JSON.stringify({
          is_whatsapp_send: false,
        })
      ),
    };

    const result = await extractWhatsAppIntentWithHermes({
      hermes,
      text: "halo joy apa kabar hari ini",
    });

    expect(result).toBeNull();
  });

  it("returns null gracefully when Hermes fails or throws an error", async () => {
    const hermes = {
      generate: vi.fn().mockRejectedValue(new Error("Network failure")),
    };

    const result = await extractWhatsAppIntentWithHermes({
      hermes,
      text: "kriim ke cenna",
    });

    expect(result).toBeNull();
  });
});
