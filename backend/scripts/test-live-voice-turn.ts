import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { parse } from "dotenv";

async function main() {
  const envContent = await readFile("/opt/joy/config/p9.1/backend.env", "utf8");
  const env = parse(envContent);

  const deviceId = env.DEVICE_ID || "joy-001";
  const deviceToken = env.DEVICE_TOKEN;
  if (!deviceToken) {
    throw new Error("DEVICE_TOKEN is missing in backend.env");
  }

  const backendUrl = "http://127.0.0.1:3000";
  const wsUrl = "ws://127.0.0.1:3000/ws";
  const requestId = randomUUID();

  console.log(`[1] Connecting WebSocket to ${wsUrl} for device ${deviceId}...`);
  const ws = new WebSocket(wsUrl);

  const events: Array<Record<string, unknown>> = [];

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS auth timeout")), 10000);

    ws.on("open", () => {
      console.log("[1.1] WS open, sending authenticate event...");
      ws.send(
        JSON.stringify({
          event: "authenticate",
          device_id: deviceId,
          device_token: deviceToken,
        }),
      );
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        events.push(msg);
        console.log(`[WS INBOX] Event:`, msg.event, msg.request_id ?? msg.status ?? "");
        if (msg.event === "authenticated") {
          clearTimeout(timer);
          resolve();
        }
      } catch (e) {
        console.error("Failed to parse WS msg:", e);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  console.log(`[2] Device authenticated. Reading input WAV...`);
  const wavPath = "/opt/joy/app/audio_wav_16k.wav";
  const wavBytes = await readFile(wavPath);
  console.log(`[2.1] Loaded WAV (${wavBytes.length} bytes). Sending POST /api/v1/voice...`);

  const tStart = Date.now();
  const voiceRes = await fetch(`${backendUrl}/api/v1/voice`, {
    method: "POST",
    headers: {
      "X-Device-Id": deviceId,
      "X-Device-Token": deviceToken,
      "X-Request-Id": requestId,
      "Content-Type": "audio/wav",
    },
    body: wavBytes,
  });

  console.log(`[3] POST /api/v1/voice response status: ${voiceRes.status}`);
  const postBody = await voiceRes.json();
  console.log(`[3.1] Body:`, postBody);

  console.log(`[4] Waiting for audio_ready event...`);
  const audioReadyEvent = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("audio_ready timeout")), 60000);

    const checkEvents = () => {
      const found = events.find((e) => e.event === "audio_ready" && e.request_id === requestId);
      if (found) {
        clearTimeout(timer);
        resolve(found);
      }
    };

    ws.on("message", () => checkEvents());
    checkEvents();
  });

  const ttfaClientMs = Date.now() - tStart;
  console.log(`[5] Received audio_ready! Client observed TTFA: ${ttfaClientMs}ms`);
  console.log(`[5.1] audio_ready event payload:`, audioReadyEvent);

  const audioUrl = String(audioReadyEvent.audio_url);
  console.log(`[6] Downloading audio from ${audioUrl}...`);
  const audioRes = await fetch(audioUrl);
  console.log(
    `[6.1] Audio response status: ${audioRes.status}, Content-Type: ${audioRes.headers.get("content-type")}, Transfer-Encoding: ${audioRes.headers.get("transfer-encoding")}`,
  );
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  console.log(`[6.2] Downloaded MP3 bytes: ${audioBuffer.length}`);

  // Send playback done to complete lifecycle
  ws.send(
    JSON.stringify({
      event: "audio_playback_done",
      request_id: requestId,
    }),
  );

  ws.close();

  console.log(`\n=== LIVE VOICE TURN TEST COMPLETED SUCCESSFULLY ===`);
  console.log(`Request ID: ${requestId}`);
  console.log(`Observed Client TTFA: ${ttfaClientMs}ms`);
  console.log(`Audio Size: ${audioBuffer.length} bytes`);
}

main().catch((err) => {
  console.error("Live voice turn failed:", err);
  process.exit(1);
});
