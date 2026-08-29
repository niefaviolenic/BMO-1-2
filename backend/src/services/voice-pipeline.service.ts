import { readFile } from "node:fs/promises";
import type { Logger } from "pino";
import type { VoiceRequestRecord } from "../domain/request-store.js";
import { RequestStoreError, type RequestStore } from "../domain/request-store.js";
import type { OutboundEvent } from "../websocket/events.js";
import type { DeviceWebSocketServer } from "../websocket/websocket.server.js";
import type { AudioServicePort, SttResult, TtsResult } from "./audio-service.client.js";
import type { HermesGenerateClient } from "./hermes.client.js";
import type { TempAudioService, LiveAudioStream } from "./temp-audio.service.js";
import { stripId3Tags } from "../utils/id3-stripper.js";

type RequestFailureCode = Extract<OutboundEvent, { event: "request_failed" }>["code"];

interface ConversationQueuePort {
  run<T = string>(key: string, work: () => Promise<T>): Promise<T>;
}

interface VoicePipelineSockets {
  sendThinking(deviceId: string, requestId: string): boolean;
  sendAudioReady(record: VoiceRequestRecord): boolean;
  sendRequestFailed(deviceId: string, requestId: string, code: RequestFailureCode): boolean;
}

export interface VoiceChatHandler {
  prepareContext(deviceId: string, text: string): Promise<{
    userId?: string;
    sessionId?: string;
    userMessageId?: string;
    prompt: string;
    conversationKey?: string;
    sessionKey?: string;
  }>;
  onResponse(result: {
    deviceId: string;
    userId?: string;
    sessionId?: string;
    userMessageId?: string;
    userText: string;
    responseText: string;
  }): Promise<void>;
  handleIntent?(input: {
    deviceId: string;
    userId?: string;
    sessionId?: string;
    text: string;
  }): Promise<{ handled: boolean; responseText?: string }>;
}

export interface VoicePipelineServiceOptions {
  publicBaseUrl: () => string;
  tempAudio: TempAudioService;
  requestStore: RequestStore;
  sockets: DeviceWebSocketServer | VoicePipelineSockets;
  logger: Pick<Logger, "error" | "warn" | "info">;
  audioService: AudioServicePort;
  hermes: HermesGenerateClient;
  conversationQueue: ConversationQueuePort;
  conversationKey: string;
  totalTimeoutMs: number;
  voiceChatHandler?: VoiceChatHandler;
}

export interface VoicePipelineResult {
  status: "audio_ready" | "failed";
  transcript?: string;
  responseText?: string;
  tts?: Pick<TtsResult, "ttsEngine">;
  errorCode?: RequestFailureCode;
  timingsMs?: Record<string, number>;
}

function isErrorWithCode(value: unknown): value is { code: unknown } {
  return typeof value === "object" && value !== null && "code" in value;
}

function mapPipelineError(error: unknown): RequestFailureCode {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case "NO_SPEECH":
      case "INVALID_AUDIO":
      case "STT_FAILED":
      case "HERMES_FAILED":
      case "TTS_FAILED":
      case "PIPELINE_TIMEOUT":
        return error.code;
      default:
        break;
    }
  }
  return "INTERNAL_ERROR";
}

export class SentenceSplitter {
  #buffer = "";
  #inThinkingTag = false;

  push(chunk: string): string[] {
    let clean = chunk;
    if (this.#inThinkingTag) {
      const closeIndex = clean.indexOf("</think>");
      if (closeIndex === -1) {
        return [];
      }
      clean = clean.slice(closeIndex + 8);
      this.#inThinkingTag = false;
    } else if (clean.includes("<think>")) {
      const openIndex = clean.indexOf("<think>");
      const closeIndex = clean.indexOf("</think>");
      if (closeIndex !== -1 && closeIndex > openIndex) {
        clean = clean.slice(0, openIndex) + clean.slice(closeIndex + 8);
      } else {
        this.#inThinkingTag = true;
        clean = clean.slice(0, openIndex);
      }
    }

    clean = clean
      .replace(/```[a-zA-Z0-9_-]*\s*/g, "")
      .replace(/```/g, "")
      .replace(/[*_#`~]+/g, "");

    this.#buffer += clean;

    const sentences: string[] = [];
    while (true) {
      const trimmed = this.#buffer.trimStart();
      if (!trimmed) {
        this.#buffer = "";
        break;
      }

      // Strong sentence boundary: . ! ? \n
      const strongMatch = trimmed.match(/^([\s\S]+?[.!?\n]+)(?:\s+|$)/);
      if (strongMatch && strongMatch[1]) {
        const candidate = strongMatch[1].trim();
        const isAbbrOrNumber =
          /(?:^|\s)(?:dr|mr|mrs|ms|prof|etc|dll|dsb|dkk|no|hal|jl|bpk|ibu|st|vs|inc|corp|ltd|co|pt|cv|\d+)\.$/i.test(
            candidate,
          );
        if (!isAbbrOrNumber) {
          const sanitized = this.#cleanForTts(candidate);
          if (sanitized) sentences.push(sanitized);
          this.#buffer = trimmed.slice(strongMatch[0].length);
          continue;
        }
      }

      // Soft clause boundary: , ; : if candidate has at least 3 words or 15 chars
      const softMatch = trimmed.match(/^([\s\S]+?[,;:])(?:\s+|$)/);
      if (softMatch && softMatch[1]) {
        const candidate = softMatch[1].trim();
        const words = candidate.split(/\s+/).filter(Boolean);
        if (words.length >= 3 || candidate.length >= 15) {
          const sanitized = this.#cleanForTts(candidate);
          if (sanitized) sentences.push(sanitized);
          this.#buffer = trimmed.slice(softMatch[0].length);
          continue;
        }
      }

      break;
    }

    return sentences;
  }

  #cleanForTts(text: string): string {
    return text
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  flush(): string[] {
    const remaining = this.#buffer.trim();
    this.#buffer = "";
    if (remaining.length > 0) {
      const sanitized = this.#cleanForTts(remaining);
      if (sanitized) return [sanitized];
    }
    return [];
  }
}

export class VoicePipelineService {
  constructor(private readonly options: VoicePipelineServiceOptions) {}

  async process(record: VoiceRequestRecord): Promise<VoicePipelineResult> {
    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(Object.assign(new Error("pipeline timeout"), { code: "PIPELINE_TIMEOUT" }));
      }, this.options.totalTimeoutMs);
    });

    try {
      return await Promise.race([this.#run(record, () => timedOut, controller.signal), timeout]);
    } catch (error) {
      const code = mapPipelineError(error);
      return this.#fail(record, code, error);
    } finally {
      clearTimeout(timer);
      await this.options.tempAudio.deleteInput(record.inputPath);
    }
  }

  async #run(
    record: VoiceRequestRecord,
    isTimedOut: () => boolean,
    signal: AbortSignal,
  ): Promise<VoicePipelineResult> {
    const totalStarted = performance.now();
    this.options.requestStore.setStatus(record.requestId, "transcribing");
    const wav = await readFile(record.inputPath);
    this.#throwIfTimedOut(isTimedOut);
    const sttStarted = performance.now();
    const stt = await this.options.audioService.transcribe(wav, signal);
    const sttMs = Math.round(performance.now() - sttStarted);
    this.#throwIfTimedOut(isTimedOut);
    if (!this.#hasSpeech(stt)) {
      throw Object.assign(new Error("no speech detected"), { code: "NO_SPEECH" });
    }
    this.options.requestStore.setStatus(record.requestId, "thinking");
    this.options.sockets.sendThinking(record.deviceId, record.requestId);

    let prompt = stt.text;
    let conversationKey = this.options.conversationKey;
    let sessionKey: string | undefined;
    let voiceContext: { userId?: string; sessionId?: string; userMessageId?: string; prompt: string; conversationKey?: string; sessionKey?: string } | undefined;

    if (this.options.voiceChatHandler) {
      try {
        voiceContext = await this.options.voiceChatHandler.prepareContext(record.deviceId, stt.text);
        if (voiceContext) {
          prompt = voiceContext.prompt;
          if (voiceContext.conversationKey) conversationKey = voiceContext.conversationKey;
          sessionKey = voiceContext.sessionKey;
        }
      } catch (err) {
        this.options.logger.warn({ request_id: record.requestId, err }, "failed to prepare voice context, falling back to raw text");
      }
    }

    if (this.options.voiceChatHandler?.handleIntent) {
      try {
        const intentResult = await this.options.voiceChatHandler.handleIntent({
          deviceId: record.deviceId,
          ...(voiceContext?.userId ? { userId: voiceContext.userId } : {}),
          ...(voiceContext?.sessionId ? { sessionId: voiceContext.sessionId } : {}),
          text: stt.text,
        });
        if (intentResult.handled && intentResult.responseText) {
          return await this.#runDirectResponse(record, stt, intentResult.responseText, totalStarted, sttMs, voiceContext, isTimedOut, signal);
        }
      } catch (err) {
        this.options.logger.warn({ request_id: record.requestId, err }, "intent handling failed, proceeding to LLM");
      }
    }

    const hasStreaming =
      typeof this.options.hermes.generateStream === "function" ||
      typeof this.options.hermes.generateResponseStream === "function";
    if (hasStreaming) {
      return await this.#runStreaming(record, stt, prompt, conversationKey, sessionKey, voiceContext, totalStarted, sttMs, isTimedOut, signal);
    }
    return await this.#runSequential(record, stt, prompt, conversationKey, sessionKey, voiceContext, totalStarted, sttMs, isTimedOut, signal);
  }

  async #runDirectResponse(
    record: VoiceRequestRecord,
    stt: SttResult,
    responseText: string,
    totalStarted: number,
    sttMs: number,
    voiceContext: { userId?: string; sessionId?: string; userMessageId?: string } | undefined,
    isTimedOut: () => boolean,
    signal: AbortSignal,
  ): Promise<VoicePipelineResult> {
    this.#throwIfTimedOut(isTimedOut);
    this.options.requestStore.setStatus(record.requestId, "generating_voice");
    const ttsStarted = performance.now();
    const tts = await this.options.audioService.synthesize(record.requestId, responseText, signal);
    const ttsMs = Math.round(performance.now() - ttsStarted);
    this.#throwIfTimedOut(isTimedOut);
    const storeStarted = performance.now();
    const audio = await this.options.tempAudio.createFromBytes(tts.audio);
    const storeMp3Ms = Math.round(performance.now() - storeStarted);
    if (isTimedOut()) {
      await this.options.tempAudio.deleteAudio(audio.audioId);
      this.#throwIfTimedOut(isTimedOut);
    }
    const ready = this.options.requestStore.markAudioReady(record.requestId, {
      audioId: audio.audioId,
      audioPath: audio.path,
      audioUrl: `${this.options.publicBaseUrl()}/audio/${audio.audioId}.mp3`,
      expiresAt: audio.expiresAt,
      transcript: stt.text,
      responseText,
    });
    this.options.sockets.sendAudioReady(ready);

    if (this.options.voiceChatHandler) {
      void this.options.voiceChatHandler.onResponse({
        deviceId: record.deviceId,
        ...(voiceContext?.userId ? { userId: voiceContext.userId } : {}),
        ...(voiceContext?.sessionId ? { sessionId: voiceContext.sessionId } : {}),
        ...(voiceContext?.userMessageId ? { userMessageId: voiceContext.userMessageId } : {}),
        userText: stt.text,
        responseText,
      }).catch((err) => {
        this.options.logger.warn({ request_id: record.requestId, err }, "failed to record voice interaction");
      });
    }

    const timingsMs = {
      stt: sttMs,
      tts: ttsMs,
      store_mp3: storeMp3Ms,
      total: Math.round(performance.now() - totalStarted),
    };
    this.options.logger.info(
      {
        request_id: record.requestId,
        language: stt.language,
        speech_detected: stt.speechDetected,
        tts_engine: tts.ttsEngine,
        timings_ms: timingsMs,
      },
      "voice pipeline completed (direct intent)",
    );
    return {
      status: "audio_ready",
      transcript: stt.text,
      responseText,
      tts: { ttsEngine: tts.ttsEngine },
      timingsMs,
    };
  }

  async #runStreaming(
    record: VoiceRequestRecord,
    stt: SttResult,
    prompt: string,
    conversationKey: string,
    sessionKey: string | undefined,
    voiceContext: { userId?: string; sessionId?: string; userMessageId?: string } | undefined,
    totalStarted: number,
    sttMs: number,
    isTimedOut: () => boolean,
    signal: AbortSignal,
  ): Promise<VoicePipelineResult> {
    const hermesStarted = performance.now();
    const liveAudio: LiveAudioStream = this.options.tempAudio.createLiveStream();
    const splitter = new SentenceSplitter();
    let fullResponseText = "";
    let sentAudioReady = false;
    let ttftMs = 0;
    let ttfaMs = 0;
    let primaryTtsEngine = "edge-tts";
    let drainIndex = 0;
    const taskPromises: Array<Promise<Buffer[]>> = [];
    let drainPromise = Promise.resolve();
    const processNextAvailable = async () => {
      while (drainIndex < taskPromises.length) {
        this.#throwIfTimedOut(isTimedOut);
        const currentIdx = drainIndex;
        const taskPromise = taskPromises[currentIdx];
        if (!taskPromise) break;
        const chunks = await taskPromise;
        drainIndex++;
        if (Array.isArray(chunks) && chunks.length > 0) {
          const rawSentenceAudio = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);
          const cleanChunk = stripId3Tags(rawSentenceAudio);
          if (cleanChunk.length > 0) {
            liveAudio.write(cleanChunk);
            if (!sentAudioReady) {
              sentAudioReady = true;
              ttfaMs = Math.round(performance.now() - totalStarted);
              this.#emitAudioReady(record, liveAudio, stt.text, fullResponseText);
            }
          }
        }
      }
    };
    const enqueueSentence = (sentenceText: string) => {
      const cleanSentence = sentenceText.trim();
      if (!cleanSentence) return;
      const audioPromise = (async () => {
        const chunks: Buffer[] = [];
        if (typeof this.options.audioService.synthesizeStream === "function") {
          const stream = this.options.audioService.synthesizeStream(record.requestId, cleanSentence, signal);
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
        } else {
          const res = await this.options.audioService.synthesize(record.requestId, cleanSentence, signal);
          if (res.ttsEngine) primaryTtsEngine = res.ttsEngine;
          chunks.push(res.audio);
        }
        return chunks;
      })();
      taskPromises.push(audioPromise);
      drainPromise = drainPromise.then(() => processNextAvailable());
    };
    try {
      await this.options.conversationQueue.run(conversationKey, async () => {
        const stream =
          typeof this.options.hermes.generateStream === "function"
            ? this.options.hermes.generateStream(prompt, signal, { conversation: conversationKey, ...(sessionKey ? { sessionKey } : {}) })
            : this.options.hermes.generateResponseStream!(prompt, signal, { conversation: conversationKey, ...(sessionKey ? { sessionKey } : {}) });
        for await (const token of stream) {
          this.#throwIfTimedOut(isTimedOut);
          if (ttftMs === 0) {
            ttftMs = Math.round(performance.now() - hermesStarted);
          }
          fullResponseText += token;
          const sentences = splitter.push(token);
          for (const sentence of sentences) {
            enqueueSentence(sentence);
          }
        }
        const remainingSentences = splitter.flush();
        for (const sentence of remainingSentences) {
          enqueueSentence(sentence);
        }
      });
      // Ensure all queued sentence syntheses are completely drained
      await drainPromise;
      if (!sentAudioReady) {
        const fallbackText = "Joy siap membantu!";
        const fallbackRes = await this.options.audioService.synthesize(record.requestId, fallbackText, signal);
        const cleanFallback = stripId3Tags(fallbackRes.audio);
        if (cleanFallback.length > 0) {
          liveAudio.write(cleanFallback);
        }
        sentAudioReady = true;
        ttfaMs = Math.round(performance.now() - totalStarted);
        this.#emitAudioReady(record, liveAudio, stt.text, fullResponseText || fallbackText);
      }
      await liveAudio.end();
      const hermesMs = Math.round(performance.now() - hermesStarted);

      if (this.options.voiceChatHandler) {
        void this.options.voiceChatHandler.onResponse({
          deviceId: record.deviceId,
          ...(voiceContext?.userId ? { userId: voiceContext.userId } : {}),
          ...(voiceContext?.sessionId ? { sessionId: voiceContext.sessionId } : {}),
          ...(voiceContext?.userMessageId ? { userMessageId: voiceContext.userMessageId } : {}),
          userText: stt.text,
          responseText: fullResponseText,
        }).catch((err) => {
          this.options.logger.warn({ request_id: record.requestId, err }, "failed to record voice interaction");
        });
      }

      const timingsMs = {
        stt: sttMs,
        ttft: ttftMs,
        ttfa: ttfaMs,
        hermes: hermesMs,
        total: Math.round(performance.now() - totalStarted),
      };
      this.options.logger.info(
        {
          request_id: record.requestId,
          language: stt.language,
          speech_detected: stt.speechDetected,
          tts_engine: primaryTtsEngine,
          timings_ms: timingsMs,
          response_preview: fullResponseText.slice(0, 80),
        },
        "voice pipeline completed (streaming)",
      );
      return {
        status: "audio_ready",
        transcript: stt.text,
        responseText: fullResponseText,
        tts: { ttsEngine: primaryTtsEngine },
        timingsMs,
      };
    } catch (error) {
      liveAudio.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  #emitAudioReady(
    record: VoiceRequestRecord,
    liveAudio: LiveAudioStream,
    transcript: string,
    responseText: string,
  ): void {
    const ready = this.options.requestStore.markAudioReady(record.requestId, {
      audioId: liveAudio.audioId,
      audioPath: liveAudio.path,
      audioUrl: `${this.options.publicBaseUrl()}/audio/${liveAudio.audioId}.mp3`,
      expiresAt: liveAudio.expiresAt,
      transcript,
      responseText,
    });
    this.options.sockets.sendAudioReady(ready);
  }

  async #runSequential(
    record: VoiceRequestRecord,
    stt: SttResult,
    prompt: string,
    conversationKey: string,
    sessionKey: string | undefined,
    voiceContext: { userId?: string; sessionId?: string; userMessageId?: string } | undefined,
    totalStarted: number,
    sttMs: number,
    isTimedOut: () => boolean,
    signal: AbortSignal,
  ): Promise<VoicePipelineResult> {
    const hermesStarted = performance.now();
    const responseText = await this.options.conversationQueue.run(conversationKey, () =>
      this.options.hermes.generate(prompt, signal, { conversation: conversationKey, ...(sessionKey ? { sessionKey } : {}) }),
    );
    const hermesMs = Math.round(performance.now() - hermesStarted);
    this.#throwIfTimedOut(isTimedOut);
    this.options.requestStore.setStatus(record.requestId, "generating_voice");
    const ttsStarted = performance.now();
    const tts = await this.options.audioService.synthesize(record.requestId, responseText, signal);
    const ttsMs = Math.round(performance.now() - ttsStarted);
    this.#throwIfTimedOut(isTimedOut);
    const storeStarted = performance.now();
    const audio = await this.options.tempAudio.createFromBytes(tts.audio);
    const storeMp3Ms = Math.round(performance.now() - storeStarted);
    if (isTimedOut()) {
      await this.options.tempAudio.deleteAudio(audio.audioId);
      this.#throwIfTimedOut(isTimedOut);
    }
    const ready = this.options.requestStore.markAudioReady(record.requestId, {
      audioId: audio.audioId,
      audioPath: audio.path,
      audioUrl: `${this.options.publicBaseUrl()}/audio/${audio.audioId}.mp3`,
      expiresAt: audio.expiresAt,
      transcript: stt.text,
      responseText,
    });
    this.options.sockets.sendAudioReady(ready);

    if (this.options.voiceChatHandler) {
      void this.options.voiceChatHandler.onResponse({
        deviceId: record.deviceId,
        ...(voiceContext?.userId ? { userId: voiceContext.userId } : {}),
        ...(voiceContext?.sessionId ? { sessionId: voiceContext.sessionId } : {}),
        ...(voiceContext?.userMessageId ? { userMessageId: voiceContext.userMessageId } : {}),
        userText: stt.text,
        responseText,
      }).catch((err) => {
        this.options.logger.warn({ request_id: record.requestId, err }, "failed to record voice interaction");
      });
    }

    const timingsMs = {
      stt: sttMs,
      hermes: hermesMs,
      tts: ttsMs,
      store_mp3: storeMp3Ms,
      total: Math.round(performance.now() - totalStarted),
    };
    this.options.logger.info(
      {
        request_id: record.requestId,
        language: stt.language,
        speech_detected: stt.speechDetected,
        tts_engine: tts.ttsEngine,
        timings_ms: timingsMs,
      },
      "voice pipeline completed",
    );
    return {
      status: "audio_ready",
      transcript: stt.text,
      responseText,
      tts: {
        ttsEngine: tts.ttsEngine,
      },
      timingsMs,
    };
  }

  #hasSpeech(stt: SttResult): boolean {
    return stt.speechDetected && stt.text.trim().length > 0;
  }

  #throwIfTimedOut(isTimedOut: () => boolean): void {
    if (isTimedOut()) {
      throw Object.assign(new Error("pipeline timeout"), { code: "PIPELINE_TIMEOUT" });
    }
  }

  #fail(record: VoiceRequestRecord, code: RequestFailureCode, error: unknown): VoicePipelineResult {
    try {
      this.options.requestStore.fail(record.requestId, code);
    } catch (storeError) {
      if (!(storeError instanceof RequestStoreError && storeError.code === "REQUEST_NOT_FOUND")) {
        this.options.logger.warn({ request_id: record.requestId, err: storeError }, "failed to mark request failed");
      }
    }
    this.options.logger.error({ request_id: record.requestId, code, err: error }, "voice pipeline failed");
    this.options.sockets.sendRequestFailed(record.deviceId, record.requestId, code);
    return { status: "failed", errorCode: code };
  }
}
