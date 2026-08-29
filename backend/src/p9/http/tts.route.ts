import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { asyncP9, currentAuth, requireAuth } from "./middleware.js";
import type { AudioServicePort } from "../../services/audio-service.client.js";
import type { TempAudioService } from "../../services/temp-audio.service.js";
import type { AccessTokenService, SessionService } from "../services/session.service.js";

const synthesizeSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  voice: z.string().optional(),
  speed: z.number().optional(),
}).strict();

export interface TtsRouterDependencies {
  audioService: AudioServicePort;
  tempAudio: TempAudioService;
  accessTokens: AccessTokenService;
  sessions: SessionService;
  publicBaseUrl: () => string;
}

export function createTtsRouter(dependencies: TtsRouterDependencies): Router {
  const router = Router();
  const authenticated = requireAuth(dependencies.accessTokens, dependencies.sessions);

  router.post("/tts/synthesize", authenticated, asyncP9(async (request, response) => {
    const auth = currentAuth(request);
    const input = synthesizeSchema.parse(request.body);
    const requestId = auth.context?.requestId || randomUUID();

    const result = await dependencies.audioService.synthesize(requestId, input.text);
    const audioRecord = await dependencies.tempAudio.createFromBytes(result.audio);
    const baseUrl = dependencies.publicBaseUrl().replace(/\/$/, "");
    const audioUrl = `${baseUrl}/audio/${audioRecord.audioId}.mp3`;

    response.status(200).json({
      success: true,
      audioId: audioRecord.audioId,
      audioUrl,
      expiresAt: new Date(audioRecord.expiresAt).toISOString(),
      engine: result.ttsEngine,
    });
  }));

  return router;
}
