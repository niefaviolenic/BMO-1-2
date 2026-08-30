import crypto from "node:crypto";

export function canonicalHmac(key: Buffer, fields: string[]): string {
  const message = fields.join("\n");
  return crypto.createHmac("sha256", key).update(message, "utf8").digest("base64url");
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyCanonicalHmac(key: Buffer, fields: string[], expectedBase64url: string): boolean {
  const actual = canonicalHmac(key, fields);
  return timingSafeEqualString(actual, expectedBase64url);
}

export function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function sha256Base64url(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("base64url");
}

export function randomNonce(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomBytes(bytes = 32): Buffer {
  return crypto.randomBytes(bytes);
}

export function encryptSecret(
  plaintext: Buffer | string,
  masterKey: Buffer,
  context: string,
): { ciphertext: string; nonce: string; tag: string } {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, nonce);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const inputBuffer = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    tag: tag.toString("base64url"),
  };
}

export function decryptSecret(
  payload: { ciphertext: string; nonce: string; tag: string },
  masterKey: Buffer,
  context: string,
): Buffer {
  const nonce = Buffer.from(payload.nonce, "base64url");
  const tag = Buffer.from(payload.tag, "base64url");
  const ciphertext = Buffer.from(payload.ciphertext, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, nonce);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function deriveSecurity2Pop(
  provisioningRootSecret: Buffer,
  provisioningRef: string,
  setupNonce: string,
): string {
  return canonicalHmac(provisioningRootSecret, [
    "joy-sec2-v1",
    provisioningRef,
    setupNonce,
  ]);
}
export function deriveSessionKey(popBase64url: string, setupNonce: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(popBase64url, "utf8"),
      Buffer.from(setupNonce, "utf8"),
      Buffer.from("joy-sec2-session-v1", "utf8"),
      32,
    ),
  );
}

export function encryptSessionEnvelope(
  popBase64url: string,
  setupNonce: string,
  aadString: string,
  payload: { res_id: string; token: string; start_proof: string; ssid: string; pass: string },
  explicitIv?: Buffer,
): { iv: string; ciphertext: string; tag: string } {
  const sessionKey = deriveSessionKey(popBase64url, setupNonce);
  const iv = explicitIv ?? crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey, iv);
  cipher.setAAD(Buffer.from(aadString, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: tag.toString("base64url"),
  };
}

export function decryptSessionEnvelope(
  popBase64url: string,
  setupNonce: string,
  aadString: string,
  envelope: { iv: string; ciphertext: string; tag: string },
): { res_id: string; token: string; start_proof: string; ssid: string; pass: string } {
  const sessionKey = deriveSessionKey(popBase64url, setupNonce);
  const iv = Buffer.from(envelope.iv, "base64url");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64url");
  const tag = Buffer.from(envelope.tag, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv);
  decipher.setAAD(Buffer.from(aadString, "utf8"));
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

export function deriveSecureStartProof(
  provisioningRootSecret: Buffer,
  params: {
    hardwareId: string;
    provisioningRef: string;
    setupNonce: string;
    resetEpoch: number;
    sessionId: string;
    reservationId: string;
  },
): string {
  return canonicalHmac(provisioningRootSecret, [
    "joy-secure-start-v1",
    params.hardwareId,
    params.provisioningRef,
    params.setupNonce,
    String(params.resetEpoch),
    params.sessionId,
    params.reservationId,
  ]);
}

export function verifyPhysicalConfirmProof(
  provisioningRootSecret: Buffer,
  params: {
    hardwareId: string;
    provisioningRef: string;
    setupNonce: string;
    resetEpoch: number;
    sessionId: string;
    challenge: string;
    confirmationNonce: string;
    proof: string;
  },
): boolean {
  return verifyCanonicalHmac(
    provisioningRootSecret,
    [
      "joy-physical-confirm-v1",
      params.hardwareId,
      params.provisioningRef,
      params.setupNonce,
      String(params.resetEpoch),
      params.sessionId,
      params.challenge,
      params.confirmationNonce,
    ],
    params.proof,
  );
}

export function verifyCommitProof(
  provisioningRootSecret: Buffer,
  params: {
    hardwareId: string;
    setupNonce: string;
    resetEpoch: number;
    reservationId: string;
    commitNonce: string;
    proof: string;
  },
): boolean {
  return verifyCanonicalHmac(
    provisioningRootSecret,
    [
      "joy-claim-commit-v1",
      params.hardwareId,
      params.setupNonce,
      String(params.resetEpoch),
      params.reservationId,
      params.commitNonce,
    ],
    params.proof,
  );
}

export function verifyFinalizeProof(
  manufacturingSecret: Buffer,
  params: {
    hardwareId: string;
    reservationId: string;
    claimToken: string;
    resetEpoch: number;
    finalizeNonce: string;
    firmwareVersion: string;
    hardwareRevision: string;
    proof: string;
  },
): boolean {
  const claimSha256Hex = sha256Hex(params.claimToken);
  return verifyCanonicalHmac(
    manufacturingSecret,
    [
      "joy-device-finalize-v1",
      params.hardwareId,
      params.reservationId,
      claimSha256Hex,
      String(params.resetEpoch),
      params.finalizeNonce,
      params.firmwareVersion,
      params.hardwareRevision,
    ],
    params.proof,
  );
}

export function verifyResetProof(
  provisioningRootSecret: Buffer,
  params: {
    hardwareId: string;
    provisioningRef: string;
    previousResetEpoch: number;
    resetEpoch: number;
    resetType: string;
    resetNonce: string;
    proof: string;
  },
): boolean {
  return verifyCanonicalHmac(
    provisioningRootSecret,
    [
      "joy-device-reset-v1",
      params.hardwareId,
      params.provisioningRef,
      String(params.previousResetEpoch),
      String(params.resetEpoch),
      params.resetType,
      params.resetNonce,
    ],
    params.proof,
  );
}
