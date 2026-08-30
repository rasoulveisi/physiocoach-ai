/**
 * PhysioCoach AI — API contract types.
 * Shared shapes for authentication and transport-level error payloads.
 */

/** Authenticated principal returned by the API. */
export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  roles: string[];
}

/** Successful login / register / refresh payload. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  /** Epoch milliseconds when the access token expires. */
  accessExpiresAt: number;
  user: User;
}

/** Standard error body returned by the API on failure. */
export interface ApiErrorPayload {
  code?: string;
  message: string;
  traceId?: string;
  auditLogId?: string;
}
