import { describe, expect, it } from "vitest";
import { RequestStore } from "../src/domain/request-store.js";

const first = {
  requestId: "550e8400-e29b-41d4-a716-446655440000",
  deviceId: "joy-001",
  inputPath: "C:/tmp/input.wav",
  inputSha256: "a".repeat(64),
  inputContentLength: 3_244,
};

describe("RequestStore", () => {
  it("tracks one active request per device", () => {
    const store = new RequestStore();
    const record = store.create(first);
    expect(record.status).toBe("accepted");
    expect(store.get(first.requestId)).toBe(record);
    expect(store.getActiveForDevice(first.deviceId)).toBe(record);
  });

  it("rejects a second active request for the same device when first is in progress (<15s)", () => {
    const store = new RequestStore();
    store.create(first);
    expect(() =>
      store.create({
        ...first,
        requestId: "6b6a1bc8-55b0-4e88-b62e-289ae089fd54",
      }),
    ).toThrowError(expect.objectContaining({ code: "DEVICE_BUSY" }));
  });

  it("supersedes previous request if it is already in audio_ready", () => {
    const store = new RequestStore();
    store.create(first);
    store.markAudioReady(first.requestId, {
      audioId: "6b6a1bc8-55b0-4e88-b62e-289ae089fd54",
      audioPath: "C:/tmp/output.mp3",
      audioUrl: "http://127.0.0.1/audio/output.mp3",
      expiresAt: Date.now() + 300_000,
    });
    const second = store.create({
      ...first,
      requestId: "7c7b2cd9-66c1-5f99-c73f-390bf190fe65",
    });
    expect(second.status).toBe("accepted");
    expect(store.get(first.requestId)?.status).toBe("failed");
    expect(store.get(first.requestId)?.errorCode).toBe("SUPERSEDED");
    expect(store.getActiveForDevice(first.deviceId)?.requestId).toBe(second.requestId);
  });

  it("supersedes previous request if it has been active for > 15 seconds", () => {
    let now = 1_000_000;
    const store = new RequestStore({ now: () => now });
    store.create(first);
    now += 16_000; // 16s later
    const second = store.create({
      ...first,
      requestId: "7c7b2cd9-66c1-5f99-c73f-390bf190fe65",
    });
    expect(second.status).toBe("accepted");
    expect(store.get(first.requestId)?.status).toBe("failed");
    expect(store.get(first.requestId)?.errorCode).toBe("SUPERSEDED");
  });

  it("releases active device lock after activeTimeoutMs (20s)", () => {
    let now = 1_000_000;
    const store = new RequestStore({ now: () => now, activeTimeoutMs: 20_000 });
    store.create(first);
    expect(store.getActiveForDevice(first.deviceId)).toBeDefined();
    now += 21_000; // 21s later
    expect(store.getActiveForDevice(first.deviceId)).toBeUndefined();
  });

  it("moves a request through audio-ready and completion", () => {
    const store = new RequestStore();
    store.create(first);
    const audioReady = store.markAudioReady(first.requestId, {
      audioId: "6b6a1bc8-55b0-4e88-b62e-289ae089fd54",
      audioPath: "C:/tmp/output.mp3",
      audioUrl: "http://127.0.0.1/audio/output.mp3",
      expiresAt: Date.now() + 300_000,
    });
    expect(audioReady.status).toBe("audio_ready");
    const completed = store.complete(first.requestId);
    expect(completed.status).toBe("completed");
    expect(store.getActiveForDevice(first.deviceId)).toBeUndefined();
  });

  it("releases the device when a request fails", () => {
    const store = new RequestStore();
    store.create(first);
    expect(store.fail(first.requestId, "INTERNAL_ERROR").status).toBe("failed");
    expect(store.getActiveForDevice(first.deviceId)).toBeUndefined();
  });
});
