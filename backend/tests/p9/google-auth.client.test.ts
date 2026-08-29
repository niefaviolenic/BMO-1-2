import { describe, expect, it, vi } from "vitest";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { GoogleAuthClient } from "../../src/p9/providers/google-auth.client.js";

describe("GoogleAuthClient Audience Hardening", () => {
  it("rejects token when audience does not match allowedClientIds", async () => {
    const keyPair = await generateKeyPair("RS256");
    const jwk = await exportJWK(keyPair.publicKey);

    // Create a mock token signed by valid RSA key but with an attacker's client ID as audience
    const invalidAudToken = await new SignJWT({
      sub: "1234567890",
      email: "user@example.com",
      email_verified: true,
      aud: "unauthorized-attacker-client-id.apps.googleusercontent.com",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://accounts.google.com")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(keyPair.privateKey);

    const client = new GoogleAuthClient({
      allowedClientIds: ["valid-joy-client-id.apps.googleusercontent.com"],
      googleTokeninfoUrl: "http://127.0.0.1:9999/tokeninfo-unreachable",
    });

    await expect(client.verifyToken({ idToken: invalidAudToken })).rejects.toThrow();
  });

  it("rejects token when tokeninfo fallback has mismatched audience", async () => {
    // Mock tokeninfo returning unauthorized audience
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: "1234567890",
        email: "victim@example.com",
        email_verified: true,
        aud: "attacker-client-id.apps.googleusercontent.com",
      }),
    } as any);

    try {
      const client = new GoogleAuthClient({
        allowedClientIds: ["valid-joy-client-id.apps.googleusercontent.com"],
      });

      await expect(client.verifyToken({ idToken: "invalid-signature-token" })).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects token when email is not verified", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: "1234567890",
        email: "unverified@example.com",
        email_verified: false,
        aud: "valid-joy-client-id.apps.googleusercontent.com",
      }),
    } as any);

    try {
      const client = new GoogleAuthClient({
        allowedClientIds: ["valid-joy-client-id.apps.googleusercontent.com"],
      });

      await expect(client.verifyToken({ idToken: "some-token" })).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts token when audience matches allowedClientIds in tokeninfo", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: "google-sub-999",
        email: "joyuser@example.com",
        email_verified: true,
        name: "Joy User",
        picture: "https://example.com/avatar.jpg",
        aud: "valid-joy-client-id.apps.googleusercontent.com",
      }),
    } as any);

    try {
      const client = new GoogleAuthClient({
        allowedClientIds: ["valid-joy-client-id.apps.googleusercontent.com"],
      });

      const identity = await client.verifyToken({ idToken: "valid-token-payload" });
      expect(identity).toEqual({
        sub: "google-sub-999",
        email: "joyuser@example.com",
        emailVerified: true,
        displayName: "Joy User",
        avatarUrl: "https://example.com/avatar.jpg",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
