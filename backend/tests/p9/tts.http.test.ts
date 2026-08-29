import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createTtsRouter } from "../../src/p9/http/tts.route.js";
import { p9ErrorHandler } from "../../src/p9/http/middleware.js";

function fixture() {
  const accessTokens = { verify: vi.fn().mockResolvedValue({ sub: "user-from-token", sid: "session-from-token" }) };
  const sessions = { isActive: vi.fn().mockResolvedValue(true) };
  const audioService = {
    transcribe: vi.fn(),
    synthesize: vi.fn().mockResolvedValue({
      audio: Buffer.from("fake-mp3-bytes"),
      ttsEngine: "edge-tts",
    }),
  };
  const tempAudio = {
    createFromBytes: vi.fn().mockResolvedValue({
      audioId: "11111111-2222-3333-4444-555555555555",
      path: "/tmp/audio/11111111-2222-3333-4444-555555555555.mp3",
      size: 14,
      expiresAt: 1700000000000,
    }),
  };
  const app = express();
  app.use(express.json());
  app.use(createTtsRouter({
    audioService: audioService as any,
    tempAudio: tempAudio as any,
    accessTokens: accessTokens as any,
    sessions: sessions as any,
    publicBaseUrl: () => "https://api.personaljoy.web.id",
  }));
  app.use(p9ErrorHandler);
  return { app, audioService, tempAudio };
}

describe("TTS HTTP contract", () => {
  it("synthesizes text and returns audioId and audioUrl when authenticated", async () => {
    const f = fixture();
    const res = await request(f.app)
      .post("/tts/synthesize")
      .set("Authorization", "Bearer access")
      .set("X-Request-Id", "req-tts-123")
      .send({ text: "Halo! Saya Joy." });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      audioId: "11111111-2222-3333-4444-555555555555",
      audioUrl: "https://api.personaljoy.web.id/audio/11111111-2222-3333-4444-555555555555.mp3",
      expiresAt: "2023-11-14T22:13:20.000Z",
      engine: "edge-tts",
    });
    expect(f.audioService.synthesize).toHaveBeenCalledWith("req-tts-123", "Halo! Saya Joy.");
    expect(f.tempAudio.createFromBytes).toHaveBeenCalledWith(Buffer.from("fake-mp3-bytes"));
  });

  it("accepts optional voice and speed parameters", async () => {
    const f = fixture();
    const res = await request(f.app)
      .post("/tts/synthesize")
      .set("Authorization", "Bearer access")
      .send({ text: "Halo!", voice: "id-ID-GadisNeural", speed: 1.0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const f = fixture();
    const res = await request(f.app)
      .post("/tts/synthesize")
      .send({ text: "Halo!" });

    expect(res.status).toBe(401);
  });

  it("rejects empty text", async () => {
    const f = fixture();
    const res = await request(f.app)
      .post("/tts/synthesize")
      .set("Authorization", "Bearer access")
      .send({ text: "   " });

    expect(res.status).toBe(400);
  });

  it("rejects unknown fields in request body", async () => {
    const f = fixture();
    const res = await request(f.app)
      .post("/tts/synthesize")
      .set("Authorization", "Bearer access")
      .send({ text: "Halo!", invalid_field: 123 });

    expect(res.status).toBe(400);
  });
});
