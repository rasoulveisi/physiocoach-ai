/**
 * Typed auth errors. Each carries an HTTP-facing error code so route handlers can
 * map them to the shared API error envelope without leaking implementation detail.
 */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'account_not_found'
  | 'token_expired'
  | 'token_invalid'
  | 'token_revoked'
  | 'password_too_weak'
  | 'invalid_request'
  | 'oauth_state_mismatch'
  | 'oauth_exchange_failed'
  | 'rate_limited';

export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  invalid_credentials: 401,
  email_taken: 409,
  account_not_found: 404,
  token_expired: 401,
  token_invalid: 401,
  token_revoked: 401,
  password_too_weak: 400,
  invalid_request: 400,
  oauth_state_mismatch: 400,
  oauth_exchange_failed: 400,
  rate_limited: 429,
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly statusCode: number;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = AUTH_ERROR_STATUS[code];
  }
}

export function isAuthError(value: unknown): value is AuthError {
  return value instanceof AuthError;
}
