import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { hashPassword, sha256Hex, verifyPassword } from "../crypto.js";
import { withP9Transaction } from "../db/client.js";
import { P9Repositories } from "../db/repositories.js";
import { P9Error } from "../errors.js";
import { DEFAULT_GOOGLE_CLIENT_RETURN, sanitizeGoogleClientReturnUrl } from "../google-return.js";
import { GoogleAuthClient, type GoogleUserIdentity } from "../providers/google-auth.client.js";
import { normalizeEmail, parseRegistration } from "../validation.js";
import { AuditService } from "./audit.service.js";
import { InvitationService } from "./invitation.service.js";
import { SessionService, type SessionTokens } from "./session.service.js";
import { publicUser, type PublicUserRecord } from "./user.service.js";

const loginSchema = z.object({
  email: z.string(),
  password: z.string().min(1).max(256),
  clientDeviceId: z.string().uuid().optional(),
}).strict();

const googleLoginSchema = z.object({
  idToken: z.string().min(10).optional(),
  accessToken: z.string().min(10).optional(),
  clientDeviceId: z.string().uuid().optional(),
}).strict().refine((data) => Boolean(data.idToken || data.accessToken), {
  message: "Either idToken or accessToken must be provided",
});

export interface AuthResult {
  user: ReturnType<typeof publicUser>;
  session: SessionTokens;
}

export interface AuthServiceOptions {
  client: PrismaClient;
  repositories: P9Repositories;
  invitations: InvitationService;
  sessions: SessionService;
  publicBaseUrl?: string;
  googleAuth?: GoogleAuthClient;
  googleClientId?: string | undefined;
  googleClientSecret?: string | undefined;
  googleCallbackUrl?: string | undefined;
}

const dummyPasswordHash = await hashPassword("p9-dummy-password-that-is-never-accepted");

export class AuthService {
  private readonly googleStates = new Map<string, { returnUrl: string; expiresAt: number }>();
  private readonly googleExchanges = new Map<string, { identity: GoogleUserIdentity; expiresAt: number }>();

  constructor(private readonly options: AuthServiceOptions) {}

  private cleanupGoogleMemoryStore(): void {
    const now = Date.now();
    for (const [key, value] of this.googleStates.entries()) {
      if (value.expiresAt <= now) {
        this.googleStates.delete(key);
      }
    }
    for (const [key, value] of this.googleExchanges.entries()) {
      if (value.expiresAt <= now) {
        this.googleExchanges.delete(key);
      }
    }
  }

  googleAuthStart(clientReturnUrl?: string): { authorizationUrl: string } {
    this.cleanupGoogleMemoryStore();
    const returnUrl = sanitizeGoogleClientReturnUrl(clientReturnUrl);
    const state = randomBytes(32).toString("hex");
    this.googleStates.set(state, {
      returnUrl,
      expiresAt: Date.now() + 600_000,
    });

    const clientId = this.options.googleClientId ?? "970789221887-q5acoua9prpstiedh4jcrcumlmpidqgv.apps.googleusercontent.com";
    const redirectUri = this.options.googleCallbackUrl ?? `${this.options.publicBaseUrl || "https://api.personalbmo.web.id"}/api/v1/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });

    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  async googleAuthCallback(
    state: string,
    code?: string,
    error?: string,
  ): Promise<{ returnUrl: string; exchangeCode?: string; error?: string }> {
    this.cleanupGoogleMemoryStore();
    const storedState = this.googleStates.get(state);
    if (!storedState || storedState.expiresAt <= Date.now()) {
      this.googleStates.delete(state);
      return {
        returnUrl: DEFAULT_GOOGLE_CLIENT_RETURN,
        error: "Invalid or expired state session",
      };
    }
    this.googleStates.delete(state);
    const returnUrl = storedState.returnUrl;

    if (error) {
      return { returnUrl, error };
    }
    if (!code) {
      return { returnUrl, error: "Missing authorization code from Google" };
    }

    const clientId = this.options.googleClientId ?? "970789221887-q5acoua9prpstiedh4jcrcumlmpidqgv.apps.googleusercontent.com";
    const redirectUri = this.options.googleCallbackUrl ?? `${this.options.publicBaseUrl || "https://api.personalbmo.web.id"}/api/v1/auth/google/callback`;

    try {
      const tokenBody: Record<string, string> = {
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      };
      if (this.options.googleClientSecret) {
        tokenBody.client_secret = this.options.googleClientSecret;
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenBody).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        console.error(JSON.stringify({ msg: "google.token_exchange.failed", status: tokenRes.status, err: errText }));
        return { returnUrl, error: "Google token exchange failed" };
      }

      const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
      const googleClient = this.options.googleAuth ?? new GoogleAuthClient();
      const identity = await googleClient.verifyToken({
        idToken: tokens.id_token ?? null,
        accessToken: tokens.access_token ?? null,
      });

      const exchangeCode = randomBytes(32).toString("hex");
      this.googleExchanges.set(exchangeCode, {
        identity,
        expiresAt: Date.now() + 60_000,
      });

      return { returnUrl, exchangeCode };
    } catch (err) {
      console.error(JSON.stringify({ msg: "google.callback.exception", err: String(err) }));
      return { returnUrl, error: "Authentication verification failed" };
    }
  }

  async consumeGoogleExchangeCode(
    exchangeCode: string,
    clientDeviceId?: string,
    requestId?: string,
  ): Promise<AuthResult> {
    this.cleanupGoogleMemoryStore();
    const pending = this.googleExchanges.get(exchangeCode);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.googleExchanges.delete(exchangeCode);
      throw new P9Error("AUTHENTICATION_FAILED", 401, "Invalid or expired Google exchange code");
    }
    this.googleExchanges.delete(exchangeCode);

    return this.loginWithVerifiedIdentity(pending.identity, clientDeviceId, requestId);
  }

  async register(input: unknown, requestId?: string): Promise<AuthResult> {
    let parsed: ReturnType<typeof parseRegistration>;
    try {
      parsed = parseRegistration(input);
    } catch {
      throw new P9Error("INVALID_INPUT", 400, "Invalid registration request");
    }

    const email = parsed.email;
    if (parsed.invitationToken) {
      await this.options.invitations.expireIfNeeded(parsed.invitationToken, new Date(), requestId);
    }

    const passwordHash = await hashPassword(parsed.password);

    try {
      return await withP9Transaction(this.options.client, async (transaction) => {
        const repositories = new P9Repositories(transaction);
        const invitation = parsed.invitationToken
          ? await this.options.invitations.consumeForRegistration(parsed.invitationToken, email, repositories)
          : null;

        const user = await repositories.user.create({
          data: {
            email,
            ...(parsed.displayName === undefined ? {} : { displayName: parsed.displayName }),
            dateOfBirth: parsed.dateOfBirth,
            passwordCredential: {
              create: {
                passwordHash,
                algorithm: "argon2id",
              },
            },
            identities: {
              create: {
                provider: "password",
                providerSubject: `local:${email}`,
              },
            },
            userSettings: {
              create: {
                timezone: "Asia/Jakarta",
              },
            },
          },
        });

        const session = await this.options.sessions.issueSession(
          { userId: user.id, ...(requestId === undefined ? {} : { requestId }) },
          repositories,
        );

        await new AuditService(repositories).record({
          eventType: "REGISTRATION_SUCCEEDED",
          outcome: "success",
          actorType: "user",
          resourceType: "user",
          resourceId: user.id,
          userId: user.id,
          ...(requestId === undefined ? {} : { context: { requestId } }),
          metadata: { email, ...(invitation ? { resourceId: invitation.id } : {}) },
        });

        return { user: publicUser(user, this.options.publicBaseUrl), session };
      });
    } catch (error) {
      if (parsed.invitationToken) {
        await this.options.invitations.expireIfNeeded(parsed.invitationToken, new Date(), requestId).catch(() => undefined);
      }
      await new AuditService(this.options.repositories).record({
        eventType: "REGISTRATION_FAILED",
        outcome: "failure",
        actorType: "anonymous",
        resourceType: "registration",
        ...(requestId === undefined ? {} : { context: { requestId } }),
        metadata: { email },
      }).catch(() => undefined);
      if (error instanceof P9Error) throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new P9Error("CONFLICT", 409, "Account already exists");
      }
      throw new P9Error("AUTHENTICATION_FAILED", 401, "Authentication failed");
    }
  }

  async login(input: unknown, requestId?: string): Promise<AuthResult> {
    let parsed: z.infer<typeof loginSchema>;
    try {
      parsed = loginSchema.parse(input);
    } catch {
      throw new P9Error("INVALID_INPUT", 400, "Invalid login request");
    }

    const email = normalizeEmail(parsed.email);
    const user = await this.options.repositories.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });

    const hashToVerify = user?.passwordCredential?.passwordHash ?? dummyPasswordHash;
    const ok = await verifyPassword(hashToVerify, parsed.password);

    if (!user || !user.passwordCredential || !ok) {
      await new AuditService(this.options.repositories).record({
        eventType: "LOGIN_FAILED",
        outcome: "failure",
        actorType: "anonymous",
        resourceType: "session",
        ...(requestId === undefined ? {} : { context: { requestId } }),
        metadata: { email },
      }).catch(() => undefined);
      throw new P9Error("AUTHENTICATION_FAILED", 401, "Invalid email or password");
    }

    const session = await this.options.sessions.issueSession({
      userId: user.id,
      ...(parsed.clientDeviceId === undefined ? {} : { clientDeviceId: parsed.clientDeviceId }),
      ...(requestId === undefined ? {} : { requestId }),
    });

    await new AuditService(this.options.repositories).record({
      eventType: "LOGIN_SUCCEEDED",
      outcome: "success",
      actorType: "user",
      resourceType: "session",
      resourceId: session.sessionId,
      userId: user.id,
      ...(requestId === undefined ? {} : { context: { requestId } }),
      metadata: { email },
    });

    return { user: publicUser(user as PublicUserRecord, this.options.publicBaseUrl), session };
  }

  async loginWithGoogle(input: unknown, requestId?: string): Promise<AuthResult> {
    let parsed: z.infer<typeof googleLoginSchema>;
    try {
      parsed = googleLoginSchema.parse(input);
    } catch {
      throw new P9Error("INVALID_INPUT", 400, "Invalid Google authentication request");
    }

    const googleClient = this.options.googleAuth ?? new GoogleAuthClient();
    const identity = await googleClient.verifyToken({
      idToken: parsed.idToken ?? null,
      accessToken: parsed.accessToken ?? null,
    });

    return this.loginWithVerifiedIdentity(identity, parsed.clientDeviceId, requestId);
  }

  private async loginWithVerifiedIdentity(
    identity: GoogleUserIdentity,
    clientDeviceId?: string,
    requestId?: string,
  ): Promise<AuthResult> {
    const email = normalizeEmail(identity.email);
    const googleSub = identity.sub;

    try {
      return await withP9Transaction(this.options.client, async (transaction) => {
        const repositories = new P9Repositories(transaction);

        // 1. Check if identity already exists
        const existingIdentity = await repositories.authIdentity.findUnique({
          where: {
            provider_providerSubject: {
              provider: "google",
              providerSubject: googleSub,
            },
          },
          include: { user: true },
        });

        if (existingIdentity && existingIdentity.user) {
          await repositories.lockUser(existingIdentity.userId);
          const user = existingIdentity.user;
          const session = await this.options.sessions.issueSession({
            userId: user.id,
            ...(clientDeviceId === undefined ? {} : { clientDeviceId }),
            ...(requestId === undefined ? {} : { requestId }),
          }, repositories);

          await new AuditService(repositories).record({
            eventType: "LOGIN_SUCCEEDED",
            outcome: "success",
            actorType: "user",
            resourceType: "session",
            resourceId: session.sessionId,
            userId: user.id,
            ...(requestId === undefined ? {} : { context: { requestId } }),
            metadata: { provider: "google" },
          });

          return { user: publicUser(user as PublicUserRecord, this.options.publicBaseUrl), session };
        }

        // 2. Check if a user with this email already exists
        await repositories.lockUser(`google-auth:${sha256Hex(email)}`);
        const existingUser = await repositories.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          await repositories.lockUser(existingUser.id);
          await repositories.authIdentity.create({
            data: {
              userId: existingUser.id,
              provider: "google",
              providerSubject: googleSub,
            },
          });

          let updatedUser = existingUser;
          if (!existingUser.displayName && identity.displayName) {
            updatedUser = await repositories.user.update({
              where: { id: existingUser.id },
              data: { displayName: identity.displayName },
            });
          }

          const session = await this.options.sessions.issueSession({
            userId: updatedUser.id,
            ...(clientDeviceId === undefined ? {} : { clientDeviceId }),
            ...(requestId === undefined ? {} : { requestId }),
          }, repositories);

          await new AuditService(repositories).record({
            eventType: "LOGIN_SUCCEEDED",
            outcome: "success",
            actorType: "user",
            resourceType: "session",
            resourceId: session.sessionId,
            userId: updatedUser.id,
            ...(requestId === undefined ? {} : { context: { requestId } }),
            metadata: { provider: "google", linked: true },
          });

          return { user: publicUser(updatedUser as PublicUserRecord, this.options.publicBaseUrl), session };
        }

        // 3. Register new user via Google
        const newUser = await repositories.user.create({
          data: {
            email,
            ...(identity.displayName ? { displayName: identity.displayName } : {}),
            identities: {
              create: {
                provider: "google",
                providerSubject: googleSub,
              },
            },
            userSettings: { create: { timezone: "Asia/Jakarta" } },
          },
        });

        const session = await this.options.sessions.issueSession({
          userId: newUser.id,
          ...(clientDeviceId === undefined ? {} : { clientDeviceId }),
          ...(requestId === undefined ? {} : { requestId }),
        }, repositories);

        await new AuditService(repositories).record({
          eventType: "REGISTRATION_SUCCEEDED",
          outcome: "success",
          actorType: "user",
          resourceType: "user",
          resourceId: newUser.id,
          userId: newUser.id,
          ...(requestId === undefined ? {} : { context: { requestId } }),
          metadata: { email, provider: "google" },
        });

        return { user: publicUser(newUser, this.options.publicBaseUrl), session };
      });
    } catch (error) {
      await new AuditService(this.options.repositories).record({
        eventType: "LOGIN_FAILED",
        outcome: "failure",
        actorType: "anonymous",
        resourceType: "session",
        ...(requestId === undefined ? {} : { context: { requestId } }),
        metadata: { email, provider: "google" },
      }).catch(() => undefined);
      if (error instanceof P9Error) throw error;
      throw new P9Error("AUTHENTICATION_FAILED", 401, "Google authentication failed");
    }
  }
}
