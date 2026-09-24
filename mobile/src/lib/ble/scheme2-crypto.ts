import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { gcm } from '@noble/ciphers/aes.js';
import { Buffer } from 'buffer';
export interface EncryptedSessionEnvelope {
  iv: string; // base64url
  ciphertext: string; // base64url
  tag: string; // base64url
}

export interface SessionEnvelopePayload {
  res_id: string;
  token: string;
  start_proof: string;
  ssid: string;
  pass: string;
}

export function toBase64Url(uint8: Uint8Array): string {
  return Buffer.from(uint8)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function deriveSessionKey(popBase64url: string, setupNonce: string): Uint8Array {
  const ikm = Buffer.from(popBase64url, 'utf8');
  const salt = Buffer.from(setupNonce, 'utf8');
  const info = Buffer.from('joy-sec2-session-v1', 'utf8');

  return hkdf(sha256, ikm, salt, info, 32);
}
export function deriveDevRootSecret(hardwareId: string, provisioningRef: string): Uint8Array {
  const key = Buffer.from('joy-dev-root-secret-v1', 'utf8');
  const msg = Buffer.from(`joy-dev-v1\n${hardwareId}\n${provisioningRef.toUpperCase()}`, 'utf8');
  return hmac(sha256, key, msg);
}

export function deriveDevSec2Pop(rootSecret: Uint8Array, provisioningRef: string, setupNonce: string): string {
  const msg = Buffer.from(`joy-sec2-pop-v1\n${provisioningRef.toUpperCase()}\n${setupNonce}`, 'utf8');
  const digest = hmac(sha256, rootSecret, msg);
  return toBase64Url(digest);
}

export function deriveDevSecureStartProof(
  rootSecret: Uint8Array,
  hardwareId: string,
  provisioningRef: string,
  setupNonce: string,
  resetEpoch: number,
  sessionId: string,
  reservationId: string,
): string {
  const msg = Buffer.from(
    `joy-secure-start-v1\n${hardwareId}\n${provisioningRef.toUpperCase()}\n${setupNonce}\n${resetEpoch}\n${sessionId}\n${reservationId}`,
    'utf8',
  );
  const digest = hmac(sha256, rootSecret, msg);
  return toBase64Url(digest);
}
export function generateSecureIv(): Uint8Array {
  // 1. Standard Web Crypto / Hermes crypto.getRandomValues
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const iv = new Uint8Array(12);
    globalThis.crypto.getRandomValues(iv);
    return iv;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    return iv;
  }

  // 2. Node.js crypto module
  try {
    const nodeCrypto = require('node:crypto');
    if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
      return new Uint8Array(nodeCrypto.randomBytes(12));
    }
  } catch {}

  // 3. Expo Crypto in React Native runtime
  try {
    const ExpoCrypto = require('expo-crypto');
    if (ExpoCrypto && typeof ExpoCrypto.getRandomBytes === 'function') {
      return ExpoCrypto.getRandomBytes(12);
    }
  } catch {}

  // 4. Entropy-mixed fallback
  const fallback = new Uint8Array(12);
  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    fallback[i] = (Math.floor(Math.random() * 256) ^ ((now >> (i % 4)) & 0xff)) & 0xff;
  }
  return fallback;
}
export function encryptSessionEnvelope(
  popBase64url: string,
  setupNonce: string,
  aadString: string,
  payload: SessionEnvelopePayload,
  explicitIv?: Uint8Array
): EncryptedSessionEnvelope {
  // 1. Derive 32-byte session key via HKDF-SHA256
  const sessionKey = deriveSessionKey(popBase64url, setupNonce);

  // 2. Generate secure 12-byte IV (or use explicit IV for deterministic test vectors)
  const iv = explicitIv ?? generateSecureIv();

  // 3. Encrypt payload with AAD via AES-256-GCM
  const plaintextBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const aadBytes = Buffer.from(aadString, 'utf8');

  const aesGcm = gcm(sessionKey, iv, aadBytes);
  const encryptedCombined = aesGcm.encrypt(plaintextBytes);

  // AES-GCM output in Noble is ciphertext followed by 16-byte authentication tag
  const tagStart = encryptedCombined.length - 16;
  const ciphertextBytes = encryptedCombined.slice(0, tagStart);
  const tagBytes = encryptedCombined.slice(tagStart);

  return {
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(ciphertextBytes),
    tag: toBase64Url(tagBytes),
  };
}
export function decryptSessionEnvelope(
  popBase64url: string,
  setupNonce: string,
  aadString: string,
  envelope: EncryptedSessionEnvelope
): SessionEnvelopePayload {
  const sessionKey = deriveSessionKey(popBase64url, setupNonce);
  const iv = fromBase64Url(envelope.iv);
  const ciphertext = fromBase64Url(envelope.ciphertext);
  const tag = fromBase64Url(envelope.tag);
  const aadBytes = Buffer.from(aadString, 'utf8');

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const aesGcm = gcm(sessionKey, iv, aadBytes);
  const decryptedBytes = aesGcm.decrypt(combined);
  const jsonStr = Buffer.from(decryptedBytes).toString('utf8');

  return JSON.parse(jsonStr) as SessionEnvelopePayload;
}
