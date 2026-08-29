import { resolveActionIntent } from "../dist/src/p9/services/action-nlu.js";
import { HermesResponsesClient } from "../dist/src/services/hermes.client.js";

async function main() {
  console.log("=== LIVE UNIFIED ACTION ROUTER VERIFICATION ===\n");

  const liveHermes = new HermesResponsesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: "8ed6463bcfae8982e9b28225cf00c4d62caaca6dbf49becbf001c1be910f9ec1",
    model: "hermes-agent",
    conversation: "unified-action-test",
    hardTimeoutMs: 30000,
  });

  const contacts = [
    { name: "cenna", phoneNumber: "+628123456789", type: "DM" },
    { name: "budi", phoneNumber: "+628987654321", type: "DM" },
    { name: "mama", phoneNumber: "+628111222333", type: "DM" },
  ];

  const testCases = [
    {
      category: "1. WhatsApp Slang/Verbless",
      input: "blg ke cenna w mau pulang sumpah demi anjir",
      expectedAction: "SEND_WHATSAPP",
    },
    {
      category: "2. WhatsApp Scrambled Typo",
      input: "whhhwwwatsapppp ke cenna ak mau mammmmm",
      expectedAction: "SEND_WHATSAPP",
    },
    {
      category: "3. Spotify Control",
      input: "puterin lagu komang dong",
      expectedAction: "SPOTIFY_CONTROL",
    },
    {
      category: "4. Schedule / Reminder",
      input: "ingetin 5 menit lagi angkat jemuran",
      expectedAction: "CREATE_SCHEDULE",
    },
    {
      category: "5. Informational Q&A",
      input: "lu tau nomor cenna ga",
      expectedAction: "NONE",
    },
    {
      category: "6. General Chat",
      input: "halo joy apa kabar",
      expectedAction: "NONE",
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    console.log(`\n--- Test: ${tc.category} ---`);
    console.log("Input:", tc.input);

    const start = Date.now();
    const result = await resolveActionIntent({
      hermes: liveHermes,
      text: tc.input,
      contacts,
      now: new Date(),
      timeoutMs: 20000,
    });
    const elapsed = Date.now() - start;

    console.log(`Latency: ${elapsed}ms`);
    console.log("Result:", JSON.stringify(result, null, 2));

    if (result.action === tc.expectedAction) {
      console.log(`✅ PASS (Action matched ${tc.expectedAction})`);
      passed++;
    } else {
      console.error(`❌ FAIL (Expected ${tc.expectedAction}, got ${result.action})`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${passed}/${testCases.length} tests passed`);
  console.log(`========================================`);

  if (passed !== testCases.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Live test failed with error:", err);
  process.exit(1);
});
