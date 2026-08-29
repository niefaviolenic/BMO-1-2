import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RequestStore, type VoiceRequestRecord } from "../src/domain/request-store.js";
import { TempAudioService } from "../src/services/temp-audio.service.js";
import { SentenceSplitter, VoicePipelineService } from "../src/services/voice-pipeline.service.js";
import { makePcmWav } from "./helpers/wav.js";

const requestId = "660e8400-e29b-41d4-a716-446655440000";

class FakeSockets {
  readonly events: Array<Record<string, unknown>> = [];
  sendThinking(deviceId: string, id: string): boolean {
    this.events.push({ event: "display_status", device_id: deviceId, request_id: id });
    return true;
  }
  sendAudioReady(record: VoiceRequestRecord): boolean {
    this.events.push({ event: "audio_ready", request_id: record.requestId, audio_url: record.audioUrl ?? undefined });
    return true;
  }
  sendRequestFailed(deviceId: string, id: string, code: string): boolean {
    this.events.push({ event: "request_failed", device_id: deviceId, request_id: id, code });
    return true;
  }
}

describe("SentenceSplitter", () => {
  it("splits streamed tokens on punctuation boundaries", () => {
    const splitter = new SentenceSplitter();
    const tokens = ["Halo", "! ", "Aku ", "Joy, ", "senang ", "bertemu ", "denganmu. ", "Ada ", "yang ", "bisa ", "kubantu?"];
    const result: string[] = [];

    for (const token of tokens) {
      const sentences = splitter.push(token);
      result.push(...sentences);
    }
    result.push(...splitter.flush());

    expect(result).toEqual([
      "Halo!",
      "Aku Joy, senang bertemu denganmu.",
      "Ada yang bisa kubantu?",
    ]);
  });

  it("filters out thinking tags from reasoning models and strips emojis", () => {
    const splitter = new SentenceSplitter();
    const tokens = ["<think>", "Thinking about greetings...", "</think>", "Halo ", "teman! 😊 ", "Senang bertemu! 🤖"];
    const result: string[] = [];

    for (const token of tokens) {
      const sentences = splitter.push(token);
      result.push(...sentences);
    }
    result.push(...splitter.flush());

    expect(result).toEqual(["Halo teman!", "Senang bertemu!"]);
  });

  it("avoids splitting on abbreviations and decimal numbers", () => {
    const splitter = new SentenceSplitter();
    const tokens = ["Halo dr. Rangga, ", "versi 2.0 Joy sudah siap membantu dll. sekarang!"];
    const result: string[] = [];

    for (const token of tokens) {
      const sentences = splitter.push(token);
      result.push(...sentences);
    }
    result.push(...splitter.flush());

    expect(result).toEqual([
      "Halo dr. Rangga,",
      "versi 2.0 Joy sudah siap membantu dll. sekarang!",
    ]);
  });

  it("splits on soft clauses if enough words are present", () => {
    const splitter = new SentenceSplitter();
    const tokens = ["Tentu saja teman baikku, ", "aku akan membantumu sekarang juga."];
    const result: string[] = [];

    for (const token of tokens) {
      const sentences = splitter.push(token);
      result.push(...sentences);
    }
    result.push(...splitter.flush());

    expect(result).toEqual([
      "Tentu saja teman baikku,",
      "aku akan membantumu sekarang juga.",
    ]);
  });
});

describe("LiveAudioStream in TempAudioService", () => {
  it("streams chunks to consumers in real-time before completion", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "joy-live-"));
    const tempAudio = new TempAudioService(tempDir, 300);
    await tempAudio.initialize();

    try {
      const liveStream = tempAudio.createLiveStream();
      const lookup = tempAudio.getForDownload(liveStream.audioId);
      expect(lookup.status).toBe("live");

      if (lookup.status === "live") {
        const receivedChunks: Buffer[] = [];
        lookup.stream.on("data", (chunk: Buffer) => {
          receivedChunks.push(chunk);
        });

        liveStream.write(Buffer.from("chunk1-"));
        liveStream.write(Buffer.from("chunk2-"));
        const record = await liveStream.end();

        expect(record.size).toBe(14);
        expect(Buffer.concat(receivedChunks).toString()).toBe("chunk1-chunk2-");

        const diskBytes = await readFile(record.path);
        expect(diskBytes.toString()).toBe("chunk1-chunk2-");

        const lookupAfter = tempAudio.getForDownload(liveStream.audioId);
        expect(lookupAfter.status).toBe("available");
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("VoicePipelineService Streaming", () => {
  it("streams sentences: sentence 1 triggers TTS and emits audio_ready before sentence 2 completes", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "joy-pipe-stream-"));
    const tempAudio = new TempAudioService(tempDir, 300);
    await tempAudio.initialize();
    const requestStore = new RequestStore();
    const inputPath = await tempAudio.writeInput(requestId, makePcmWav());

    const record = requestStore.create({
      requestId,
      deviceId: "joy-001",
      inputPath,
      inputSha256: "sha",
      inputContentLength: 1,
    });

    const sockets = new FakeSockets();
    const ttsCalls: string[] = [];

    const service = new VoicePipelineService({
      publicBaseUrl: () => "http://127.0.0.1:3000",
      tempAudio,
      requestStore,
      sockets,
      logger: { error() {}, warn() {}, info() {} },
      audioService: {
        transcribe: async () => ({
          text: "halo joy",
          speechDetected: true,
          language: "id",
          languageProbability: 0.9,
          durationSeconds: 1.0,
        }),
        synthesize: async () => ({
          audio: Buffer.from("fallback"),
          ttsEngine: "piper",
        }),
        synthesizeStream: async function* (_reqId: string, text: string) {
          ttsCalls.push(text);
          yield Buffer.from(`[audio:${text}]`);
        },
      },
      hermes: {
        generate: async () => "Fallback response",
        generateStream: async function* () {
          yield "Halo teman! ";
          yield "Aku Joy yang senang membantumu.";
        },
      },
      conversationQueue: { run: <T>(_key: string, work: () => Promise<T>): Promise<T> => work() },
      conversationKey: "joy-001",
      totalTimeoutMs: 3_000,
    });

    try {
      const result = await service.process(record);
      expect(result.status).toBe("audio_ready");
      expect(result.responseText).toBe("Halo teman! Aku Joy yang senang membantumu.");
      expect(ttsCalls).toEqual([
        "Halo teman!",
        "Aku Joy yang senang membantumu.",
      ]);

      const readyEvent = sockets.events.find((e) => e.event === "audio_ready");
      expect(readyEvent).toBeDefined();

      const ready = requestStore.get(requestId)!;
      expect(ready.status).toBe("audio_ready");
      const diskBytes = await readFile(ready.audioPath!);
      expect(diskBytes.toString()).toBe("[audio:Halo teman!][audio:Aku Joy yang senang membantumu.]");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("supports generateResponseStream fallback on HermesGenerateClient", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "joy-pipe-stream-2-"));
    const tempAudio = new TempAudioService(tempDir, 300);
    await tempAudio.initialize();
    const requestStore = new RequestStore();
    const inputPath = await tempAudio.writeInput(requestId, makePcmWav());

    const record = requestStore.create({
      requestId,
      deviceId: "joy-001",
      inputPath,
      inputSha256: "sha",
      inputContentLength: 1,
    });

    const sockets = new FakeSockets();

    const service = new VoicePipelineService({
      publicBaseUrl: () => "http://127.0.0.1:3000",
      tempAudio,
      requestStore,
      sockets,
      logger: { error() {}, warn() {}, info() {} },
      audioService: {
        transcribe: async () => ({
          text: "halo",
          speechDetected: true,
          language: "id",
          languageProbability: 0.9,
          durationSeconds: 1.0,
        }),
        synthesize: async () => ({
          audio: Buffer.from("synthesized-audio"),
          ttsEngine: "edge-tts",
        }),
      },
      hermes: {
        generate: async () => "Fallback response",
        generateResponseStream: async function* () {
          yield "Siap! ";
          yield "Joy ada di sini.";
        },
      },
      conversationQueue: { run: <T>(_key: string, work: () => Promise<T>): Promise<T> => work() },
      conversationKey: "joy-001",
      totalTimeoutMs: 3_000,
    });

    try {
      const result = await service.process(record);
      expect(result.status).toBe("audio_ready");
      expect(result.responseText).toBe("Siap! Joy ada di sini.");
      expect(sockets.events.map((e) => e.event)).toEqual(["display_status", "audio_ready"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses VoiceChatHandler to prepare user persona/memory context and record response", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "joy-pipe-ctx-"));
    const tempAudio = new TempAudioService(tempDir, 300);
    await tempAudio.initialize();

    const requestStore = new RequestStore();
    const inputPath = await tempAudio.writeInput(requestId, makePcmWav());
    const record = requestStore.create({
      requestId,
      deviceId: "joy-001",
      inputPath,
      inputSha256: "sha",
      inputContentLength: 1,
    });

    const sockets = new FakeSockets();
    let preparedDeviceId = "";
    let recordedResult: unknown = null;
    let hermesReceivedPrompt = "";

    const service = new VoicePipelineService({
      publicBaseUrl: () => "http://127.0.0.1:3000",
      tempAudio,
      requestStore,
      sockets,
      logger: { error() {}, warn() {}, info() {} },
      audioService: {
        transcribe: async () => ({
          text: "nama saya siapa?",
          speechDetected: true,
          language: "id",
          languageProbability: 0.9,
          durationSeconds: 1.0,
        }),
        synthesize: async () => ({
          audio: Buffer.from("synthesized-audio"),
          ttsEngine: "edge-tts",
        }),
      },
      hermes: {
        generate: async () => "Fallback response",
        generateStream: async function* (prompt: string) {
          hermesReceivedPrompt = prompt;
          yield "Nama kamu ";
          yield "Ranggara2!";
        },
      },
      conversationQueue: { run: <T>(_key: string, work: () => Promise<T>): Promise<T> => work() },
      conversationKey: "joy-001",
      totalTimeoutMs: 3_000,
      voiceChatHandler: {
        prepareContext: async (deviceId, text) => {
          preparedDeviceId = deviceId;
          return {
            userId: "user-123",
            sessionId: "session-456",
            prompt: JSON.stringify({ user: { displayName: "Ranggara2" }, currentMessage: text }),
            conversationKey: "chat:user-123:session-456",
            sessionKey: "joy:user:user-123",
          };
        },
        onResponse: async (result) => {
          recordedResult = result;
        },
      },
    });

    try {
      const result = await service.process(record);
      expect(result.status).toBe("audio_ready");
      expect(result.responseText).toBe("Nama kamu Ranggara2!");
      expect(preparedDeviceId).toBe("joy-001");
      expect(hermesReceivedPrompt).toContain("Ranggara2");
      expect(recordedResult).toEqual({
        deviceId: "joy-001",
        userId: "user-123",
        sessionId: "session-456",
        userText: "nama saya siapa?",
        responseText: "Nama kamu Ranggara2!",
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("strips ID3 tags from streaming TTS chunks so LiveAudioStream contains pure MP3 frames without chunk-boundary ID3 metadata", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "joy-pipe-id3-"));
    const tempAudio = new TempAudioService(tempDir, 300);
    await tempAudio.initialize();

    const requestStore = new RequestStore();
    const inputPath = await tempAudio.writeInput(requestId, makePcmWav());
    const record = requestStore.create({
      requestId,
      deviceId: "joy-001",
      inputPath,
      inputSha256: "sha",
      inputContentLength: 1,
    });

    const sockets = new FakeSockets();
    const makeId3Mp3 = (tagSize: number, payload: Buffer) => {
      const header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, tagSize]);
      const id3Data = Buffer.alloc(tagSize, 0xee);
      return Buffer.concat([header, id3Data, payload]);
    };

    const mp3Chunk1 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x11, 0x11]);
    const mp3Chunk2 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x22, 0x22]);

    const service = new VoicePipelineService({
      publicBaseUrl: () => "http://127.0.0.1:3000",
      tempAudio,
      requestStore,
      sockets,
      logger: { error() {}, warn() {}, info() {} },
      audioService: {
        transcribe: async () => ({
          text: "hello",
          speechDetected: true,
          language: "id",
          languageProbability: 0.9,
          durationSeconds: 1.0,
        }),
        synthesize: async (_reqId, text) => {
          const payload = text.includes("Halo") ? mp3Chunk1 : mp3Chunk2;
          return {
            audio: makeId3Mp3(10, payload),
            ttsEngine: "edge-tts",
          };
        },
      },
      hermes: {
        generate: async () => "Halo! Senang bertemu.",
        generateStream: async function* () {
          yield "Halo! ";
          yield "Senang bertemu.";
        },
      },
      conversationQueue: { run: <T>(_key: string, work: () => Promise<T>): Promise<T> => work() },
      conversationKey: "joy-001",
      totalTimeoutMs: 3_000,
    });

    try {
      const result = await service.process(record);
      expect(result.status).toBe("audio_ready");

      const readyRecord = requestStore.get(requestId);
      expect(readyRecord?.audioPath).toBeDefined();

      const diskData = await readFile(readyRecord!.audioPath!);
      expect(diskData).toEqual(Buffer.concat([mp3Chunk1, mp3Chunk2]));
      expect(diskData.includes(Buffer.from("ID3"))).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
