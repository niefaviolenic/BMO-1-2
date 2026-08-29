import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  configureHttpAuth,
  configureMobileWebSocket,
  connectMobileWebSocket,
  disconnectMobileWebSocket,
  isApiError,
} from '@/lib/api';
import {
  refreshChatSessions,
  resetChatSessionState,
} from '@/features/chat/data/chat-session-store';
import {
  hydrateDevices,
  resetRobotConnection,
} from '@/features/robot/data/robot-connection-store';

import {
  requestAndRegisterPushToken,
  unregisterCurrentPushToken,
} from '@/features/notifications';
import {
  fetchCurrentUser,
  loginAccount,
  loginWithGoogle,
  logoutCurrentSession,
  refreshAuthSession,
  registerAccount,
  resetPassword,
  verifyPasswordRecovery,
} from '../data/auth-api';
import { secureSessionStore } from '../data/secure-session-store';
import type { AuthSession, RecoveryChallenge, RegisterAccountInput, SafeUser } from '../domain/types';

type AuthStatus = 'hydrating' | 'ready';

export type AuthSessionContextValue = {
  status: AuthStatus;
  user: SafeUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: (payload: { exchangeCode?: string; idToken?: string; accessToken?: string }) => Promise<void>;
  register: (input: RegisterAccountInput) => Promise<void>;
  logout: () => Promise<void>;
  verifyRecovery: (email: string, dateOfBirth: string) => Promise<RecoveryChallenge>;
  resetAccountPassword: (recoveryToken: string, newPassword: string) => Promise<void>;
  applyUser: (user: SafeUser) => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const ACCESS_TOKEN_SKEW_MS = 30_000;

function isAccessTokenFresh(session: AuthSession): boolean {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt - ACCESS_TOKEN_SKEW_MS > Date.now();
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('hydrating');
  const [user, setUser] = useState<SafeUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const userRef = useRef<SafeUser | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const persistAuth = useCallback(async (nextUser: SafeUser, nextSession: AuthSession) => {
    userRef.current = nextUser;
    sessionRef.current = nextSession;
    setUser(nextUser);
    setSession(nextSession);
    await secureSessionStore.save({ user: nextUser, session: nextSession });
  }, []);

  const clearAuth = useCallback(async () => {
    userRef.current = null;
    sessionRef.current = null;
    setUser(null);
    setSession(null);
    await secureSessionStore.clear();
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const current = sessionRef.current;
      if (!current) {
        return null;
      }

      try {
        const nextSession = await refreshAuthSession(current.refreshToken);
        const nextUser = userRef.current;
        if (nextUser) {
          await persistAuth(nextUser, nextSession);
        } else {
          sessionRef.current = nextSession;
          setSession(nextSession);
        }
        return nextSession.accessToken;
      } catch {
        await clearAuth();
        return null;
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [clearAuth, persistAuth]);

  useEffect(() => {
    configureHttpAuth({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshAccessToken,
    });
    configureMobileWebSocket({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshAccessToken,
    });

    return () => {
      disconnectMobileWebSocket();
      configureMobileWebSocket(null);
      configureHttpAuth(null);
    };
  }, [refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const persisted = await secureSessionStore.load();
      if (cancelled) {
        return;
      }

      if (!persisted) {
        setStatus('ready');
        return;
      }

      userRef.current = persisted.user;
      sessionRef.current = persisted.session;
      setUser(persisted.user);
      setSession(persisted.session);

      try {
        if (!isAccessTokenFresh(persisted.session)) {
          const nextToken = await refreshAccessToken();
          if (!nextToken) {
            return;
          }
        }

        const nextUser = await fetchCurrentUser();
        const currentSession = sessionRef.current;
        if (cancelled || !currentSession) {
          return;
        }

        await persistAuth(nextUser, currentSession);
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          const nextToken = await refreshAccessToken();
          if (!nextToken) {
            return;
          }

          try {
            const nextUser = await fetchCurrentUser();
            const currentSession = sessionRef.current;
            if (!cancelled && currentSession) {
              await persistAuth(nextUser, currentSession);
            }
          } catch {
            await clearAuth();
          }
        } else {
          await clearAuth();
        }
      } finally {
        if (!cancelled) {
          setStatus('ready');
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [clearAuth, persistAuth, refreshAccessToken]);

  useEffect(() => {
    if (user && session) {
      connectMobileWebSocket();
      void refreshChatSessions().catch(() => undefined);
      void hydrateDevices().catch(() => undefined);
      void requestAndRegisterPushToken(user.id).catch(() => undefined);
      return;
    }

    disconnectMobileWebSocket();
    void unregisterCurrentPushToken().catch(() => undefined);
    resetChatSessionState();
    resetRobotConnection();
  }, [session, user]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginAccount(email, password);
      await persistAuth(result.user, result.session);
    },
    [persistAuth],
  );
  const loginGoogle = useCallback(
    async (payload: { exchangeCode?: string; idToken?: string; accessToken?: string }) => {
      const result = await loginWithGoogle(payload);
      await persistAuth(result.user, result.session);
    },
    [persistAuth],
  );


  const register = useCallback(
    async (input: RegisterAccountInput) => {
      const result = await registerAccount(input);
      await persistAuth(result.user, result.session);
    },
    [persistAuth],
  );

  const logout = useCallback(async () => {
    try {
      if (sessionRef.current) {
        await logoutCurrentSession();
      }
    } catch {
      // Local sign-out still proceeds if the network call fails.
    } finally {
      await clearAuth();
    }
  }, [clearAuth]);

  const verifyRecovery = useCallback(async (email: string, dateOfBirth: string) => {
    return verifyPasswordRecovery(email, dateOfBirth);
  }, []);

  const resetAccountPassword = useCallback(async (recoveryToken: string, newPassword: string) => {
    await resetPassword(recoveryToken, newPassword);
  }, []);

  const applyUser = useCallback(
    async (nextUser: SafeUser) => {
      const currentSession = sessionRef.current;
      if (!currentSession) {
        return;
      }
      await persistAuth(nextUser, currentSession);
    },
    [persistAuth],
  );

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      status,
      user,
      session,
      isAuthenticated: Boolean(user && session),
      login,
      loginGoogle,
      register,
      logout,
      verifyRecovery,
      resetAccountPassword,
      applyUser,
    }),
    [
      applyUser,
      login,
      loginGoogle,
      logout,
      register,
      resetAccountPassword,
      session,
      status,
      user,
      verifyRecovery,
    ],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return value;
}

export function useOptionalAuthSession(): AuthSessionContextValue | null {
  return useContext(AuthSessionContext);
}
