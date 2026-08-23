const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
export const AUTH_TOKEN_KEY = 'physiocoach_auth_token';

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

// In-flight GET request deduplicator
const inFlightGets = new Map<string, Promise<any>>();

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = options.token !== undefined ? options.token : localStorage.getItem(AUTH_TOKEN_KEY);
  const cacheKey = method === 'GET' ? `${token || 'anon'}:${path}` : null;

  if (cacheKey && inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey)! as Promise<T>;
  }

  const promise = (async () => {
    try {
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

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        const problem = typeof payload === 'object' && payload !== null ? (payload as Partial<ProblemDetails>) : {};
        throw new ApiError({
          ...problem,
          title: problem.title || response.statusText || 'Request failed',
          status: problem.status || response.status,
          detail: problem.detail || (typeof payload === 'string' ? payload : undefined),
        });
      }

      return payload as T;
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
