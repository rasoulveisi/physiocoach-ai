export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/api/v1';
  }
  return 'https://physiocoach-ai-api.otconnect.ir/api/v1';
}

export const API_URL = getApiBaseUrl();
export const AUTH_TOKEN_KEY = 'physiocoach_auth_token';
export const REFRESH_TOKEN_KEY = 'physiocoach_refresh_token';
export const USER_KEY = 'physiocoach_auth_user';

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
  method?: string;
}

// Endpoints that manage their own session lifecycle never trigger the silent-refresh flow.
const SESSION_PATHS = new Set(['auth/login', 'auth/register', 'auth/refresh']);

const isSessionPath = (path: string): boolean => SESSION_PATHS.has(path.replace(/^\//, ''));

function clearStoredTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface AuthAttempt {
  response: Response;
  payload: unknown;
}

async function sendRequest(path: string, method: string, options: ApiRequestOptions, token: string | null): Promise<AuthAttempt> {
  const { body, headers, ...init } = options;
  const response = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, {
    ...init,
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = (response.headers.get('content-type') || '').includes('json');
  const payload: unknown = isJson ? await response.json() : await response.text();
  return { response, payload };
}

function toProblem(payload: unknown, response: Response): ProblemDetails {
  const problem = typeof payload === 'object' && payload !== null ? (payload as Partial<ProblemDetails>) : {};
  return {
    ...problem,
    title: problem.title || response.statusText || 'Request failed',
    status: problem.status || response.status,
    detail: problem.detail || (typeof payload === 'string' ? payload : undefined),
  };
}

// Silent refresh mutex: at most one /auth/refresh call in flight; concurrent 401s join the shared promise.
let refreshPromise: Promise<string | null> | null = null;

interface RefreshResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
}

async function performSilentRefresh(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearStoredTokens();
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return null;
    }

    const attempt = await sendRequest('auth/refresh', 'POST', { body: { refreshToken }, token: null }, null);
    const data: RefreshResponse = typeof attempt.payload === 'object' && attempt.payload !== null ? attempt.payload : {};
    if (!attempt.response.ok || !data.accessToken) {
      throw new Error(toProblem(attempt.payload, attempt.response).detail || 'Silent refresh failed.');
    }

    localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    if (data.user !== undefined && data.user !== null) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('auth:session-updated', { detail: data }));
    return data.accessToken;
  } catch {
    clearStoredTokens();
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    return null;
  } finally {
    refreshPromise = null;
  }
}

function requestSilentRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performSilentRefresh();
  }
  return refreshPromise;
}

// In-flight GET request deduplicator
const inFlightGets = new Map<string, Promise<any>>();

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const allowRefresh = !isSessionPath(path);
  const token = options.token !== undefined ? options.token : localStorage.getItem(AUTH_TOKEN_KEY);
  const cacheKey = method === 'GET' ? `${token || 'anon'}:${path}` : null;

  if (cacheKey && inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey)! as Promise<T>;
  }

  const promise = (async () => {
    try {
      let attempt = await sendRequest(path, method, options, token);

      if (attempt.response.status === 401 && allowRefresh) {
        const refreshedToken = await requestSilentRefresh();
        if (refreshedToken) {
          attempt = await sendRequest(path, method, options, refreshedToken);
        }
      }

      if (!attempt.response.ok) {
        throw new ApiError(toProblem(attempt.payload, attempt.response));
      }

      return attempt.payload as T;
    } finally {
      if (cacheKey) {
        inFlightGets.delete(cacheKey);
      }
    }
  })();

  if (cacheKey) {
    inFlightGets.set(cacheKey, promise);
  }

  return promise;
}

export const apiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) => apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) => apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: ApiRequestOptions) => apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
