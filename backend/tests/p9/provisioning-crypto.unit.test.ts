import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  canonicalHmac,
  deriveSecurity2Pop,
  deriveSecureStartProof,
  verifyPhysicalConfirmProof,
  verifyCommitProof,
  verifyFinalizeProof,
  verifyResetProof,
  encryptSecret,
  decryptSecret,
  sha256Hex,
} from "../../src/p9/crypto/provisioning-crypto.js";

describe("Provisioning Cryptography & Golden Vectors", () => {
  const fixturePath = "/Users/ranggabiner/Downloads/full bmo/JOY_BLE_V4_PACKAGE/JOY_BLE_V4_GOLDEN_VECTORS.json";
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const key = Buffer.from(fixture.test_key_hex, "hex");
  const fields = fixture.fields;

  it("passes all synthetic golden vectors", () => {
    // 1. POP
    const pop = deriveSecurity2Pop(key, fields.provisioning_ref, fields.setup_nonce);
    const popVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-POP");
    expect(pop).toBe(popVector.expected_base64url);

    // 2. Physical confirm
    const physicalVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-PHYSICAL");
    const physicalValid = verifyPhysicalConfirmProof(key, {
      hardwareId: fields.hardware_id,
      provisioningRef: fields.provisioning_ref,
      setupNonce: fields.setup_nonce,
      resetEpoch: Number(fields.reset_epoch),
      sessionId: fields.session_id,
      challenge: fields.challenge,
      confirmationNonce: fields.confirmation_nonce,
      proof: physicalVector.expected_base64url,
    });
    expect(physicalValid).toBe(true);

    // 3. Secure start
    const secureStartVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-SECURE-START");
    const secureStart = deriveSecureStartProof(key, {
      hardwareId: fields.hardware_id,
      provisioningRef: fields.provisioning_ref,
      setupNonce: fields.setup_nonce,
      resetEpoch: Number(fields.reset_epoch),
      sessionId: fields.session_id,
      reservationId: fields.reservation_id,
    });
    expect(secureStart).toBe(secureStartVector.expected_base64url);

    // 4. Claim commit
    const commitVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-CLAIM-COMMIT");
    const commitValid = verifyCommitProof(key, {
      hardwareId: fields.hardware_id,
      setupNonce: fields.setup_nonce,
      resetEpoch: Number(fields.reset_epoch),
      reservationId: fields.reservation_id,
      commitNonce: fields.commit_nonce,
      proof: commitVector.expected_base64url,
    });
    expect(commitValid).toBe(true);

    // 5. Finalize
    const finalizeVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-FINALIZE");
    expect(sha256Hex(fields.claim_token)).toBe(finalizeVector.claim_sha256_hex);
    const finalizeValid = verifyFinalizeProof(key, {
      hardwareId: fields.hardware_id,
      reservationId: fields.reservation_id,
      claimToken: fields.claim_token,
      resetEpoch: Number(fields.reset_epoch),
      finalizeNonce: fields.finalize_nonce,
      firmwareVersion: fields.firmware_version,
      hardwareRevision: fields.hardware_revision,
      proof: finalizeVector.expected_base64url,
    });
    expect(finalizeValid).toBe(true);

    // 6. Reset
    const resetVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-RESET");
    const resetValid = verifyResetProof(key, {
      hardwareId: fields.hardware_id,
      provisioningRef: fields.provisioning_ref,
      previousResetEpoch: Number(fields.previous_reset_epoch),
      resetEpoch: Number(fields.reset_epoch),
      resetType: fields.reset_type,
      resetNonce: fields.reset_nonce,
      proof: resetVector.expected_base64url,
    });
    expect(resetValid).toBe(true);
  });

  it("fails verification on mutated proofs or inputs", () => {
    const physicalVector = fixture.vectors.find((v: any) => v.id === "V4-SYNTH-001-PHYSICAL");
    // Mutated challenge
    expect(verifyPhysicalConfirmProof(key, {
      hardwareId: fields.hardware_id,
      provisioningRef: fields.provisioning_ref,
      setupNonce: fields.setup_nonce,
      resetEpoch: Number(fields.reset_epoch),
      sessionId: fields.session_id,
      challenge: "mutated_challenge",
      confirmationNonce: fields.confirmation_nonce,
      proof: physicalVector.expected_base64url,
    })).toBe(false);

    // Mutated key
    const wrongKey = Buffer.alloc(32, 0xff);
    expect(verifyPhysicalConfirmProof(wrongKey, {
      hardwareId: fields.hardware_id,
      provisioningRef: fields.provisioning_ref,
      setupNonce: fields.setup_nonce,
      resetEpoch: Number(fields.reset_epoch),
      sessionId: fields.session_id,
      challenge: fields.challenge,
      confirmationNonce: fields.confirmation_nonce,
      proof: physicalVector.expected_base64url,
    })).toBe(false);
  });

  it("encrypts and decrypts secrets with context authentication tag", () => {
    const masterKey = Buffer.alloc(32, 0x42);
    const secret = Buffer.from("super-secret-manufacturing-key-256bit", "utf8");
    const context = "joy_hardware_identity:manufacturing_secret";

    const encrypted = encryptSecret(secret, masterKey, context);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = decryptSecret(encrypted, masterKey, context);
    expect(decrypted.toString("utf8")).toBe("super-secret-manufacturing-key-256bit");

    // Decryption with wrong context must fail
    expect(() => decryptSecret(encrypted, masterKey, "wrong_context")).toThrow();
  });
});
