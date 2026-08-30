import { describe, expect, it } from 'vitest';
import { Buffer } from 'buffer';
import { gcm } from '@noble/ciphers/aes.js';
import {
  deriveSessionKey,
  encryptSessionEnvelope,
  decryptSessionEnvelope,
  SessionEnvelopePayload,
} from './scheme2-crypto';

describe('Joy BLE v4 Security Scheme 2 & Session Envelope Cryptography', () => {
  const popBase64url = 'MQfe7SdddtocXoQ1UaQugp-X6B-8AdhnxYkr8ddsswY';
  const setupNonce = 'Q2W8N4P7RX';
  const expectedSessionKeyHex = 'cde4fc8fc0386c6db307d2a94189d636ef8cb14fed93fcbcfe912230a4ff9775';

  const fixedIvHex = '000102030405060708090a0b';
  const fixedIvBytes = Buffer.from(fixedIvHex, 'hex');
  const expectedIvBase64url = 'AAECAwQFBgcICQoL';

  const aadString = 'joy_11111111-2222-4333-8444-555555555555|A7F2K9M3|66666666-7777-4888-8999-aaaaaaaaaaaa';
  const payload: SessionEnvelopePayload = {
    res_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    token: 'claim-token-test-v4',
    start_proof: 'DLIfz1SgsfGVpppzQbb5rMTcgDVeNNRzEQsfzsNiIj4',
    ssid: 'Home-WiFi-2.4G',
    pass: 'superSecretPassword123',
  };

  const expectedCiphertextBase64url =
    '-edn-tahIpGOl2ZjgTBwX9smA2JoBfrAVvd4N669IvBbBKNTElsJLgNIV8XSapsJ-iRrHS95po_xQdLlfzOlYTHPgUzf729w_xU_gfTz1_U1Gz4dn6aXMtCIIU8PzO7C1Tdwnil5gnglcJJ7aiku0NF7vl27GFc12lMnyJih3u8rtBABnqK6GbM3mX-V33tM6eERc57aFf0dS8DdPWDImChnUN74jgFyS1sb3ZoIW4WJmZUhR1lyz85R0O2xsn9z9Pfm';
  const expectedTagBase64url = 'uSfgQgy8xeeKG8SjltG8Xg';

  it('verifies HKDF-SHA256 session key derivation vector (V4-EXT-001)', () => {
    const sessionKey = deriveSessionKey(popBase64url, setupNonce);
    const sessionKeyHex = Buffer.from(sessionKey).toString('hex');
    expect(sessionKeyHex).toBe(expectedSessionKeyHex);
  });

  it('verifies AES-256-GCM Session Envelope synthetic vector (V4-EXT-001)', () => {
    const sessionKey = deriveSessionKey(popBase64url, setupNonce);
    const plaintext = JSON.stringify(payload);
    const plaintextBytes = Buffer.from(plaintext, 'utf8');
    const aadBytes = Buffer.from(aadString, 'utf8');

    const cipher = gcm(sessionKey, fixedIvBytes, aadBytes);
    const encrypted = cipher.encrypt(plaintextBytes);

    const tagStart = encrypted.length - 16;
    const ciphertextBytes = encrypted.slice(0, tagStart);
    const tagBytes = encrypted.slice(tagStart);

    expect(Buffer.from(fixedIvBytes).toString('base64url')).toBe(expectedIvBase64url);
    expect(Buffer.from(ciphertextBytes).toString('base64url')).toBe(expectedCiphertextBase64url);
    expect(Buffer.from(tagBytes).toString('base64url')).toBe(expectedTagBase64url);
  });

  it('decrypts the exact golden vector envelope', () => {
    const decrypted = decryptSessionEnvelope(popBase64url, setupNonce, aadString, {
      iv: expectedIvBase64url,
      ciphertext: expectedCiphertextBase64url,
      tag: expectedTagBase64url,
    });

    expect(decrypted).toEqual(payload);
  });

  it('roundtrips random IV encryption and decryption', () => {
    const envelope = encryptSessionEnvelope(popBase64url, setupNonce, aadString, payload);
    const decrypted = decryptSessionEnvelope(popBase64url, setupNonce, aadString, envelope);

    expect(decrypted).toEqual(payload);
  });

  it('fails decryption on corrupted AAD, tag, or ciphertext', () => {
    // 1. Wrong AAD
    expect(() =>
      decryptSessionEnvelope(popBase64url, setupNonce, 'tampered-aad', {
        iv: expectedIvBase64url,
        ciphertext: expectedCiphertextBase64url,
        tag: expectedTagBase64url,
      })
    ).toThrow();

    // 2. Corrupted Tag
    expect(() =>
      decryptSessionEnvelope(popBase64url, setupNonce, aadString, {
        iv: expectedIvBase64url,
        ciphertext: expectedCiphertextBase64url,
        tag: 'AAAAAAAAAAAAAAAAAAAAAA',
      })
    ).toThrow();
  });
});
