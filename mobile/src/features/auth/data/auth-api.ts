import { apiRequest } from '@/lib/api';

import type {
  AuthResult,
  AuthSession,
  RecoveryChallenge,
  RegisterAccountInput,
  SafeUser,
} from '../domain/types';

type SessionResponse = {
  session: AuthSession;
};

type UserResponse = {
  user: SafeUser;
};

export async function registerAccount(input: RegisterAccountInput): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/register', {
    method: 'POST',
    auth: false,
    body: {
      email: input.email,
      password: input.password,
      dateOfBirth: input.dateOfBirth,
      ...(input.displayName ? { displayName: input.displayName } : {}),
    },
  });
}

export async function loginAccount(
  email: string,
  password: string,
  /** Paired Joy device UUID only. Omit the local app install id. */
  clientDeviceId?: string,
): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    auth: false,
    body: {
      email,
      password,
      ...(clientDeviceId ? { clientDeviceId } : {}),
    },
  });
}

export async function loginWithGoogle(input: {
  exchangeCode?: string;
  idToken?: string;
  accessToken?: string;
  clientDeviceId?: string;
}): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/google', {
    method: 'POST',
    auth: false,
    body: {
      ...(input.exchangeCode ? { exchangeCode: input.exchangeCode } : {}),
      ...(input.idToken ? { idToken: input.idToken } : {}),
      ...(input.accessToken ? { accessToken: input.accessToken } : {}),
      ...(input.clientDeviceId ? { clientDeviceId: input.clientDeviceId } : {}),
    },
  });
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthSession> {
  const payload = await apiRequest<SessionResponse>('/auth/refresh', {
    method: 'POST',
    auth: false,
    skipRefresh: true,
    body: { refreshToken },
  });
  return payload.session;
}

export async function logoutCurrentSession(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}

export async function logoutAllSessions(): Promise<void> {
  await apiRequest<void>('/auth/logout-all', { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<SafeUser> {
  const payload = await apiRequest<UserResponse>('/me');
  return payload.user;
}

export async function verifyPasswordRecovery(
  email: string,
  dateOfBirth: string,
): Promise<RecoveryChallenge> {
  return apiRequest<RecoveryChallenge>('/auth/password/recovery/verify', {
    method: 'POST',
    auth: false,
    body: { email, dateOfBirth },
  });
}

export async function resetPassword(recoveryToken: string, newPassword: string): Promise<void> {
  await apiRequest<void>('/auth/password/recovery/reset', {
    method: 'POST',
    auth: false,
    body: { recoveryToken, newPassword },
  });
}
