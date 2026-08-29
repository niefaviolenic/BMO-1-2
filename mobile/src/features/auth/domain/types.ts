export type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type AuthSession = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export type AuthResult = {
  user: SafeUser;
  session: AuthSession;
};

export type PersistedAuth = {
  user: SafeUser;
  session: AuthSession;
};

export type RecoveryChallenge = {
  recoveryToken: string;
  expiresAt: string;
};

export type RegisterAccountInput = {
  email: string;
  password: string;
  dateOfBirth: string;
  displayName?: string;
};
