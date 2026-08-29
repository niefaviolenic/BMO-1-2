import { detectScheduleIntent } from "./src/p9/services/schedule-intent.js";
import { extractScheduleIntentWithHermes } from "./src/p9/services/schedule-nlu.js";
import { HermesResponsesClient } from "./src/services/hermes.client.js";

async function main() {
  console.log("=== LIVE PRODUCTION HERMES NLU EXTRACTION TEST ===\n");
  
  const liveHermes = new HermesResponsesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: "8ed6463bcfae8982e9b28225cf00c4d62caaca6dbf49becbf001c1be910f9ec1",
    model: "hermes-agent",
    conversation: "schedule-nlu-test",
    hardTimeoutMs: 30000,
  });

  const now = new Date();
  console.log("Current Reference Time (Server):", now.toISOString());

  // Case 1: Standard dictionary phrase
  const phrase1 = "Hai Joy ingetin 5 menit lagi untuk minum air";
  console.log("\n--- CASE 1: Standard Dictionary Phrase ---");
  console.log("Input:", phrase1);
  const regex1 = detectScheduleIntent(phrase1, now);
  console.log("1. detectScheduleIntent (Regex/Dict) result:");
  console.log(JSON.stringify(regex1, null, 2));

  // Case 2: Natural colloquial Indonesian phrase (NO dictionary keywords like 'ingat', 'ingetin', 'jadwal', 'alarm')
  const phrase2 = "Joy besok lusa jam 3 sore temenin gue nonton bola";
  console.log("\n--- CASE 2: Natural Language Phrase (No Dict/Regex Keyword) ---");
  console.log("Input:", phrase2);
  const regex2 = detectScheduleIntent(phrase2, now);
  console.log("1. detectScheduleIntent (Regex/Dict) result:", regex2);
  
  if (regex2 === null) {
    console.log("-> Regex detection returned NULL as expected (fallback triggered).");
    console.log("2. Calling live Hermes NLU (extractScheduleIntentWithHermes)...");
    const nlu2 = await extractScheduleIntentWithHermes({
      hermes: liveHermes,
      text: phrase2,
      now,
      timeoutMs: 15000,
    });
    console.log("3. extractScheduleIntentWithHermes Result:");
    console.log(JSON.stringify(nlu2, null, 2));
  }

  // Case 3: Non-schedule conversational phrase
  const phrase3 = "Joy menurut kamu cuaca hari ini gimana?";
  console.log("\n--- CASE 3: Non-schedule Conversational Phrase ---");
  console.log("Input:", phrase3);
  const regex3 = detectScheduleIntent(phrase3, now);
  console.log("1. detectScheduleIntent result:", regex3);
  const nlu3 = await extractScheduleIntentWithHermes({
    hermes: liveHermes,
    text: phrase3,
    now,
    timeoutMs: 15000,
  });
  console.log("2. extractScheduleIntentWithHermes Result (should be null):", nlu3);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
