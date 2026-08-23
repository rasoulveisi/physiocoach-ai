import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../services/api-client';

export interface User { id: string; email: string; displayName?: string | null; role?: string | null; roles?: string[]; }
interface AuthSession { accessToken: string; refreshToken?: string; user: User; }
interface Credentials { email: string; password: string; }
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  login(credentials: Credentials): Promise<void>;
  register(credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
  setSession(session: AuthSession): void;
  updateUser(updates: Partial<User>): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  try { const value = localStorage.getItem(USER_KEY); return value ? JSON.parse(value) as User : null; }
  catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Sync React state with silent background refreshes performed by api-client.
  // Declared before the restore effect so listeners are active while it verifies the session.
  useEffect(() => {
    const handleSessionUpdated = (event: Event) => {
      const data = (event as CustomEvent<Partial<AuthSession>>).detail;
      if (!data?.accessToken) return;
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
    };
    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:session-updated', handleSessionUpdated);
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-updated', handleSessionUpdated);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  // Startup restore: hydrate from storage, then verify the access token against the API.
  // An expired token triggers api-client's silent refresh before the retry of auth/me.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      setToken(storedToken);
      setUser(readStoredUser());

      if (storedToken) {
        try {
          const { user: verified } = await apiClient.get<{ user: User }>('auth/me');
          if (!cancelled && verified) {
            setUser(verified);
            localStorage.setItem(USER_KEY, JSON.stringify(verified));
          }
        } catch {
          /* Stale session: api-client already cleared storage and dispatched auth:session-expired. */
        }
      }
      if (!cancelled) setIsRestoring(false);
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  const storeSession = useCallback((session: AuthSession) => {
    localStorage.setItem(AUTH_TOKEN_KEY, session.accessToken);
    if (session.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.accessToken);
    setUser(session.user);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    storeSession(await apiClient.post<AuthSession>('auth/login', credentials, { token: null }));
  }, [storeSession]);

  const register = useCallback(async (credentials: Credentials) => {
    storeSession(await apiClient.post<AuthSession>('auth/register', credentials, { token: null }));
  }, [storeSession]);

  const logout = useCallback(async () => {
    try { if (token) await apiClient.post<void>('auth/logout'); } catch { /* Local logout still succeeds. */ }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isRestoring,
      login,
      register,
      logout,
      setSession: storeSession,
      updateUser,
    }),
    [user, token, isRestoring, login, register, logout, storeSession, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
