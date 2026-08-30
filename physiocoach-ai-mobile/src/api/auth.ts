/**
 * PhysioCoach AI — Authentication API methods.
 * Thin typed wrappers over the HTTP client for the /auth surface.
 */

import { request } from './client';
import type { AuthResponse, User } from './types';

/** POST /auth/login */
export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    auth: false,
  });
}

/** POST /auth/register */
export async function register(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResponse> {
  const trimmedName = displayName?.trim();
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      email: email.trim(),
      password,
      ...(trimmedName ? { displayName: trimmedName } : {}),
    },
    auth: false,
  });
}

/** POST /auth/refresh — exchanges a refresh token for a new token pair. */
export async function refresh(refreshToken: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });
}

/**
 * POST /auth/logout — best-effort server-side revocation. Network failures are
 * swallowed so the local logout flow always completes.
 */
export async function logout(): Promise<{ success: boolean }> {
  try {
    return await request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: {},
    });
  } catch {
    return { success: false };
  }
}

/** GET /auth/me — validates the access token and returns the current user. */
export async function getMe(): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me', { method: 'GET' });
}

/** POST /auth/oauth/exchange — exchanges Google OAuth authorization code and state for JWT session tokens. */
export async function exchangeOAuthCode(code: string, state: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/oauth/exchange', {
    method: 'POST',
    body: { code, state },
    auth: false,
  });
}
