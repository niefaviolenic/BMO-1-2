import WebSocket from "ws";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/src/generated/prisma/client.js";

const DATABASE_URL = "postgresql://joy:db2a72dbe91ccaea4a3f141ab88036915640d110abd3d45100f7e7bdc0e0ac10@localhost/joy?host=%2Fvar%2Flib%2Fdocker%2Fvolumes%2Fjoy-production-p9_p9_production_postgres_socket%2F_data";
const WS_URL = "ws://127.0.0.1:3000/ws";
const HARDWARE_ID = "joy-001";
const DEVICE_TOKEN = "962c00aa4b579dbea27f26a77924c8c2c9563a3f1f34ee4cddd876b792c80316";

async function run() {
  console.log("=== Starting Live Schedule Speech End-to-End Verification ===");

  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const device = await prisma.device.findFirst({
    where: { hardwareId: HARDWARE_ID, status: "ACTIVE" },
    select: { id: true, hardwareId: true, userId: true, name: true },
  });

  if (!device) {
    throw new Error(`No active device found with hardwareId ${HARDWARE_ID}`);
  }

  console.log(`Found active device: DB UUID=${device.id}, HardwareID=${device.hardwareId}, UserID=${device.userId}`);

  const session = await prisma.chatSession.findFirst({
    where: { userId: device.userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  console.log(`Using active session: ${session?.id ?? "none"}`);

  // 1. Connect simulated robot hardware socket
  console.log(`Connecting WebSocket to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  console.log("WebSocket connected. Authenticating...");
  ws.send(JSON.stringify({
    event: "authenticate",
    device_id: HARDWARE_ID,
    device_token: DEVICE_TOKEN,
  }));

  const authenticated = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Auth timeout")), 5000);
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === "authenticated") {
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    });
  });

  console.log("WebSocket authenticated successfully:", authenticated);

  // Give 1 second for resolveApplicationBinding in backend to complete
  await new Promise((r) => setTimeout(r, 1000));

  // Set up audio_ready listener
  let audioReadyPromiseResolve;
  let audioReadyPromiseReject;
  const audioReadyPromise = new Promise((resolve, reject) => {
    audioReadyPromiseResolve = resolve;
    audioReadyPromiseReject = reject;
  });

  const messageHandler = (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log("[WS Received]", msg.event, msg);
      if (msg.event === "audio_ready") {
        audioReadyPromiseResolve(msg);
      }
    } catch (err) {
      console.error("Error handling ws message:", err);
    }
  };

  ws.on("message", messageHandler);

  // 2. Create schedule with targetDeviceId set to Database UUID (device.id)
  const dueAt = new Date(Date.now() - 2000); // 2s in the past so it triggers immediately
  const scheduleTitle = "Waktunya baca quran";
  const schedulePrompt = "ingetin gw buat baca quran al waqiah";

  const schedule = await prisma.schedule.create({
    data: {
      userId: device.userId,
      targetDeviceId: device.id, // DATABASE UUID!
      timezone: "Asia/Jakarta",
      status: "ACTIVE",
      recurrence: {
        frequency: "Once",
        every: 1,
        date: dueAt.toISOString().split("T")[0],
        timeOfDay: "Morning",
      },
      payload: {
        title: scheduleTitle,
        prompt: schedulePrompt,
        sessionId: session?.id,
        deliveryTargets: ["MOBILE", "DEVICE"],
      },
      nextRunAt: dueAt,
    },
  });

  console.log(`Created test schedule: ID=${schedule.id}, TargetDevice UUID=${device.id}`);
  console.log("Waiting for backend scheduler to materialize run and dispatch audio_ready (up to 45s)...");

  // Wait for audio_ready or timeout
  const timeoutId = setTimeout(() => {
    audioReadyPromiseReject(new Error("Timeout waiting for audio_ready event on robot socket"));
  }, 45000);

  let receivedEvent;
  try {
    receivedEvent = await audioReadyPromise;
    clearTimeout(timeoutId);
    console.log("SUCCESS: Received audio_ready event on robot WebSocket!");
    console.log("Payload:", JSON.stringify(receivedEvent, null, 2));

    // Verify audio_url accessibility
    if (receivedEvent.audio_url) {
      console.log(`Verifying audio URL: ${receivedEvent.audio_url}...`);
      const res = await fetch(receivedEvent.audio_url);
      console.log(`Audio URL status: ${res.status} ${res.statusText}, Content-Type: ${res.headers.get("content-type")}, Size: ${res.headers.get("content-length")} bytes`);
      if (!res.ok) {
        throw new Error(`Audio URL returned status ${res.status}`);
      }
    }
  } finally {
    clearTimeout(timeoutId);
    ws.close();

    // Cleanup test schedule
    try {
      await prisma.scheduleRun.deleteMany({ where: { scheduleId: schedule.id } });
      await prisma.schedule.delete({ where: { id: schedule.id } });
      console.log("Cleaned up test schedule and runs from DB.");
    } catch (e) {
      console.warn("Cleanup warning:", e.message);
    }

    await prisma.$disconnect();
  }

  console.log("=== End-to-End Verification Complete and PASSED! ===");
}

run().catch((err) => {
  console.error("Verification FAILED:", err);
  process.exit(1);
});
