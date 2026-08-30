/**
 * PhysioCoach AI — Authentication context.
 *
 * Owns the session lifecycle: persists tokens + cached user profile in
 * AsyncStorage, restores the session on app startup (getMe() first, refresh()
 * as fallback), exposes login / register / logout, and resets to signed-out
 * when the API client reports a hard 401 (silent refresh failed).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as authApi from '../api/auth';
import {
  ApiError,
  STORAGE_KEYS,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  loadTokensFromStorage,
  onUnauthorized,
  setTokens as persistTokens,
} from '../api/client';
import type { AuthResponse, User } from '../api/types';

/** Session state + actions exposed to the app. */
export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const applyAuthResponse = useCallback(async (auth: AuthResponse): Promise<void> => {
    await persistTokens(auth.accessToken, auth.refreshToken);
    await AsyncStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(auth.user));
    setUser(auth.user);
    setToken(auth.accessToken);
    setError(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      try {
        const response = await authApi.login(email, password);
        await applyAuthResponse(response);
        return true;
      } catch (err) {
        setError(toFriendlyAuthError(err));
        return false;
      }
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string): Promise<boolean> => {
      setError(null);
      try {
        const response = await authApi.register(email, password, displayName);
        await applyAuthResponse(response);
        return true;
      } catch (err) {
        setError(toFriendlyAuthError(err));
        return false;
      }
    },
    [applyAuthResponse],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Best-effort server-side revocation; local wipe always proceeds.
      await authApi.logout();
    } finally {
      await clearTokens();
      await AsyncStorage.removeItem(STORAGE_KEYS.userProfile);
      setUser(null);
      setToken(null);
      setError(null);
    }
  }, []);

  /**
   * Startup restore: load tokens + cached profile from AsyncStorage, then
   * validate the access token via getMe(). On failure, fall back to a
   * refresh(); when that also fails, wipe the session.
   */
  const restoreSession = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await loadTokensFromStorage();
      const cachedUser = readCachedUser(
        await AsyncStorage.getItem(STORAGE_KEYS.userProfile),
      );
      const storedToken = await getAccessToken();

      if (!storedToken) {
        setUser(null);
        setToken(null);
        return;
      }

      // Optimistically hydrate from cache while validating in the background.
      setUser(cachedUser);
      setToken(storedToken);

      try {
        const me = await authApi.getMe();
        if (me?.user) {
          setUser(me.user);
          await AsyncStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(me.user));
        }
      } catch (getMeError) {
        const refreshTokenValue = await getRefreshToken();
        if (!refreshTokenValue) {
          throw getMeError;
        }
        const refreshed = await authApi.refresh(refreshTokenValue);
        await applyAuthResponse(refreshed);
      }
    } catch {
      // Session could not be restored — start signed out.
      await clearTokens();
      await AsyncStorage.removeItem(STORAGE_KEYS.userProfile);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthResponse]);

  useEffect(() => {
    void restoreSession();
    // Reset to signed-out when the client reports an unrecoverable 401.
    const unsubscribe = onUnauthorized(() => {
      setUser(null);
      setToken(null);
      void AsyncStorage.removeItem(STORAGE_KEYS.userProfile);
      setError('Your session has expired. Please sign in again.');
    });
    return unsubscribe;
  }, [restoreSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: token !== null,
      error,
      login,
      register,
      logout,
      clearError,
    }),
    [user, token, isLoading, error, login, register, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth session state + actions. Must be used under AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ---------------------------------------------------------------------------
// Helpers (module scope, pure)
// ---------------------------------------------------------------------------

/** Parse and shape-check a cached user profile JSON blob. */
function readCachedUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { id?: unknown }).id === 'string' &&
      typeof (parsed as { email?: unknown }).email === 'string' &&
      Array.isArray((parsed as { roles?: unknown }).roles)
    ) {
      return parsed as User;
    }
    return null;
  } catch {
    return null;
  }
}

/** Map ApiError variants to clear, B1-level messages. */
function toFriendlyAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Cannot reach the server. Check your internet connection.';
    }
    if (error.status === 401) {
      return 'Incorrect email or password.';
    }
    if (error.status === 403) {
      return 'This account is not allowed to sign in.';
    }
    if (error.status === 409) {
      return 'An account with this email already exists.';
    }
    if (error.status >= 500) {
      return 'The server had a problem. Please try again shortly.';
    }
    return error.message || 'Authentication failed. Please try again.';
  }
  return 'Authentication failed. Please try again.';
}
