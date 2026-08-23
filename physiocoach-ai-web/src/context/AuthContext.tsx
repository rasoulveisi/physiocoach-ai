import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, AUTH_TOKEN_KEY } from '../services/api-client';

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
}

const USER_KEY = 'physiocoach_auth_user';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  try { const value = localStorage.getItem(USER_KEY); return value ? JSON.parse(value) as User : null; }
  catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    setToken(localStorage.getItem(AUTH_TOKEN_KEY));
    setUser(readStoredUser());
    setIsRestoring(false);
  }, []);

  const storeSession = useCallback((session: AuthSession) => {
    localStorage.setItem(AUTH_TOKEN_KEY, session.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.accessToken);
    setUser(session.user);
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
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(() => ({ user, token, isAuthenticated: Boolean(token), isRestoring, login, register, logout, setSession: storeSession }), [user, token, isRestoring, login, register, logout, storeSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
