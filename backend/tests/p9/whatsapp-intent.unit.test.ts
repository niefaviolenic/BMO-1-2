import { describe, expect, it } from "vitest";
import { detectWhatsAppIntent, hasWhatsAppCue } from "../../src/p9/services/whatsapp-intent.js";

describe("detectWhatsAppIntent", () => {
  it("detects Indonesian send WhatsApp commands with 'bilang/bilangin'", () => {
    expect(
      detectWhatsAppIntent("kirim whatsapp ke cenna dong bilangin ke dia kalo gw dah dirumah")
    ).toEqual({
      recipient: "cenna",
      message: "gw dah dirumah",
    });

    expect(
      detectWhatsAppIntent("kirim wa ke cenna bilang gw dah sampe rumah")
    ).toEqual({
      recipient: "cenna",
      message: "gw dah sampe rumah",
    });

    expect(
      detectWhatsAppIntent("kirim wa ke si cenna bilangin aku otw")
    ).toEqual({
      recipient: "cenna",
      message: "aku otw",
    });

    expect(
      detectWhatsAppIntent("tolong kirimkan pesan wa ke Cenna bilangin jangan lupa makan ya")
    ).toEqual({
      recipient: "Cenna",
      message: "jangan lupa makan ya",
    });
  });

  it("detects Indonesian commands with colon or quotes", () => {
    expect(
      detectWhatsAppIntent("kirim pesan whatsapp ke cenna: halo apa kabar")
    ).toEqual({
      recipient: "cenna",
      message: "halo apa kabar",
    });

    expect(
      detectWhatsAppIntent("kirim wa ke cenna isinya besok jadi ya")
    ).toEqual({
      recipient: "cenna",
      message: "besok jadi ya",
    });

    expect(
      detectWhatsAppIntent("wa ke cenna: nanti malam jadi")
    ).toEqual({
      recipient: "cenna",
      message: "nanti malam jadi",
    });

    expect(
      detectWhatsAppIntent('kirim wa ke cenna "otw bro"')
    ).toEqual({
      recipient: "cenna",
      message: "otw bro",
    });
  });

  it("detects English send WhatsApp commands", () => {
    expect(
      detectWhatsAppIntent("send whatsapp to cenna saying i am home")
    ).toEqual({
      recipient: "cenna",
      message: "i am home",
    });

    expect(
      detectWhatsAppIntent("send a whatsapp message to Cenna Wijaya that i will be late")
    ).toEqual({
      recipient: "Cenna Wijaya",
      message: "i will be late",
    });

    expect(
      detectWhatsAppIntent("tell cenna on whatsapp that i am already home")
    ).toEqual({
      recipient: "cenna",
      message: "i am already home",
    });
  });

  it("returns null for non-whatsapp messages", () => {
    expect(detectWhatsAppIntent("Halo Joy, apa kabar?")).toBeNull();
    expect(detectWhatsAppIntent("putar lagu tulus")).toBeNull();
    expect(detectWhatsAppIntent("ingatkan saya minum obat jam 8")).toBeNull();
  });
});


describe("hasWhatsAppCue", () => {
  it("detects WhatsApp cues in slang, typos, and elongated texts", () => {
    expect(hasWhatsAppCue("kriim ke wwwwwwwaaaaaaa cenna bilanggg aku ganteng")).toBe(true);
    expect(hasWhatsAppCue("kirim wa ke cenna bilang aku mau pulangggg")).toBe(true);
    expect(hasWhatsAppCue("wa ke cenna bilang otw")).toBe(true);
    expect(hasWhatsAppCue("tolong kirim pesan ke cenna lewat wa")).toBe(true);
    expect(hasWhatsAppCue("send a message on whatsapp to cenna")).toBe(true);
  });

  it("returns false for non-whatsapp messages", () => {
    expect(hasWhatsAppCue("halo joy apa kabar")).toBe(false);
    expect(hasWhatsAppCue("putar lagu komang")).toBe(false);
    expect(hasWhatsAppCue("ingatkan saya jam 8")).toBe(false);
  });
});
