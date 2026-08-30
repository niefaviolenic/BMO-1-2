import crypto from "node:crypto";
import { createP9Client, disconnectP9Client } from "../db/client.js";
import { parseP9Config } from "../config.js";
import { ProvisioningService } from "../services/provisioning.service.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const hardwareId = argument("--hardware-id");
  const provisioningRef = argument("--provisioning-ref");
  const mfgHex = argument("--manufacturing-secret-hex");
  const rootHex = argument("--root-secret-hex");

  if (!hardwareId || !provisioningRef || !mfgHex || !rootHex) {
    throw new Error(
      "usage: node dist/src/p9/operator/enroll-hardware.js --hardware-id joy_xxx --provisioning-ref REF --manufacturing-secret-hex <64-hex-chars> --root-secret-hex <64-hex-chars>"
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(mfgHex) || !/^[0-9a-fA-F]{64}$/.test(rootHex)) {
    throw new Error("manufacturing-secret-hex and root-secret-hex must be exactly 64 hexadecimal characters (32 bytes)");
  }

  const config = parseP9Config({ ...process.env, P9_ENABLED: "true" });
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error("JWT_SECRET is required and must be at least 16 characters");
  }
  const client = createP9Client(config);
  const masterKey = crypto.createHash("sha256").update(config.jwtSecret, "utf8").digest();
  const provisioning = new ProvisioningService({ client, masterKey });
  const mfgSecret = Buffer.from(mfgHex, "hex");
  const rootSecret = Buffer.from(rootHex, "hex");
  try {
    await provisioning.registerHardwareIdentity({
      hardwareId,
      provisioningRef: provisioningRef.toUpperCase(),
      manufacturingSecret: mfgSecret,
      provisioningRootSecret: rootSecret,
    });
    process.stdout.write(`Hardware identity enrolled successfully: hardwareId=${hardwareId}, ref=${provisioningRef.toUpperCase()}\n`);
  } finally {
    await disconnectP9Client(client);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "hardware enrollment failed"}\n`);
  process.exitCode = 1;
});
