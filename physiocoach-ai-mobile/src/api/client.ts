/**
 * PhysioCoach AI — Resilient HTTP client.
 *
 * Responsibilities:
 *  - Base URL resolution (default production API, overridable via
 *    `EXPO_PUBLIC_API_URL` for local/dev backends).
 *  - Token persistence in AsyncStorage behind get/set/clear helpers.
 *  - JSON request helper (GET/POST/PUT/DELETE/PATCH) with request timeouts,
 *    `Authorization: Bearer` injection and `x-request-id` audit tracing.
 *  - 401 response interceptor: single-flight silent refresh via
 *    `POST /auth/refresh`, then one retry of the original request; on refresh
 *    failure it clears tokens and notifies the auth context.
 *  - `ApiError` carrying status, code, traceId and auditLogId.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ApiErrorPayload, AuthResponse } from './types';

export const DEFAULT_BASE_URL = 'https://physiocoach-ai-api.otconnect.ir/api/v1';

const envApiUrl = (
  globalThis as { process?: { env?: { EXPO_PUBLIC_API_URL?: string } } }
).process?.env?.EXPO_PUBLIC_API_URL;

export const BASE_URL = envApiUrl || DEFAULT_BASE_URL;

/** Persistent storage keys shared with the auth context. */
export const STORAGE_KEYS = {
  accessToken: '@physiocoach/access_token',
  refreshToken: '@physiocoach/refresh_token',
  userProfile: '@physiocoach/user_profile',
} as const;

const REQUEST_TIMEOUT_MS = 20_000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

/** Transport/API failure with traceable identifiers. */
export class ApiError extends Error {
  /** HTTP status, or 0 for network-level failures (offline / timeout). */
  readonly status: number;
  readonly code?: string;
  readonly traceId?: string;
  readonly auditLogId?: string;

  constructor(status: number, message: string, payload?: Partial<ApiErrorPayload>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code;
    this.traceId = payload?.traceId;
    this.auditLogId = payload?.auditLogId;
  }
}

// ---------------------------------------------------------------------------
// Token store (memory + AsyncStorage)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshToken: string | null = null;

let refreshInFlight: Promise<boolean> | null = null;
const unauthorizedListeners = new Set<() => void>();

/** Restore tokens from AsyncStorage into the in-memory cache (app startup). */
export async function loadTokensFromStorage(): Promise<void> {
  const [storedAccess, storedRefresh] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.accessToken),
    AsyncStorage.getItem(STORAGE_KEYS.refreshToken),
  ]);
  accessToken = storedAccess;
  refreshToken = storedRefresh;
}

/** Persist a fresh token pair (memory + storage). */
export async function setTokens(nextAccess: string, nextRefresh: string): Promise<void> {
  accessToken = nextAccess;
  refreshToken = nextRefresh;
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.accessToken, nextAccess),
    AsyncStorage.setItem(STORAGE_KEYS.refreshToken, nextRefresh),
  ]);
}

/** Wipe tokens (memory + storage). */
export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.accessToken),
    AsyncStorage.removeItem(STORAGE_KEYS.refreshToken),
  ]);
}

/** Current access token: memory first, AsyncStorage fallback. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  accessToken = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
  return accessToken;
}

/** Current refresh token: memory first, AsyncStorage fallback. */
export async function getRefreshToken(): Promise<string | null> {
  if (refreshToken) return refreshToken;
  refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  return refreshToken;
}

/**
 * Subscribe to hard auth failures (401 that refresh could not recover).
 * Returns an unsubscribe function. The auth context uses this to reset state.
 */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Listener errors must never break the request path.
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * UUID v4 for `x-request-id`. Prefers the platform crypto implementation and
 * falls back to a random-based UUID (sufficient for correlation, not secrets).
 */
function generateRequestId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function buildHeaders(auth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': generateRequestId(),
  };
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: Record<string, unknown> | undefined;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON error body — fall back to generic message.
  }

  const nestedError = typeof payload?.error === 'object' && payload.error !== null
    ? (payload.error as Record<string, unknown>)
    : undefined;

  const retryAfter = response.headers.get('retry-after');
  const code = (nestedError?.code ?? payload?.code) as string | undefined;
  let message = (nestedError?.message ?? payload?.message) as string | undefined;

  if (!message) {
    if (response.status === 429) {
      message = retryAfter
        ? `Too many attempts. Please wait ${retryAfter} seconds before retrying.`
        : 'Too many attempts. Please wait 1 minute before retrying.';
    } else {
      message = `Request failed with status ${response.status}`;
    }
  }

  const traceId = (nestedError?.requestId ?? payload?.traceId ?? payload?.requestId) as string | undefined;
  const auditLogId = (nestedError?.auditLogId ?? payload?.auditLogId) as string | undefined;

  return new ApiError(response.status, message, { code, message, traceId, auditLogId });
}

// ---------------------------------------------------------------------------
// Silent refresh (single-flight)
// ---------------------------------------------------------------------------

async function performRefresh(): Promise<boolean> {
  const currentRefresh = await getRefreshToken();
  if (!currentRefresh) return false;
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/auth/refresh`,
      {
        method: 'POST',
        headers: buildHeaders(false),
        body: JSON.stringify({ refreshToken: currentRefresh }),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) return false;
    const data = (await response.json()) as AuthResponse;
    if (!data?.accessToken || !data?.refreshToken) return false;
    await setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/** Refresh once per burst of parallel 401s. */
function attemptTokenRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-serializable request body. */
  body?: unknown;
  /** Attach `Authorization` header; defaults to true. */
  auth?: boolean;
  /** Internal guard against refresh-retry loops. */
  isRetry?: boolean;
  timeoutMs?: number;
}

/**
 * Perform an API request. Throws {@link ApiError} on any failure.
 * On 401 (non-auth endpoints): attempts a silent refresh, retries once, and
 * on failure clears tokens + notifies the auth context.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    isRetry = false,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${BASE_URL}${path}`,
      {
        method,
        headers: buildHeaders(auth),
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Check your connection and try again.');
    }
    throw new ApiError(0, 'Network request failed. Check your connection and try again.');
  }

  if (response.status === 401 && auth && !isRetry && path !== '/auth/refresh') {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, isRetry: true });
    }
    await clearTokens();
    notifyUnauthorized();
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'The server returned an unexpected response.');
  }
}
