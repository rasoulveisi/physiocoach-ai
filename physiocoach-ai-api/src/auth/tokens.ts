import { SignJWT, jwtVerify } from 'jose';

import type { AuthKeyConfig } from './keys';

const encoder = new TextEncoder();

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  email: string;
  roles: string[];
  type: 'access';
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthUserClaims {
  userId: string;
  email: string;
  roles: string[];
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresAt: string;
}

/**
 * Issues a short-lived HS256 access JWT bound to a session.
 */
export async function signAccessToken(
  config: AuthKeyConfig,
  user: AuthUserClaims,
  sessionId: string,
): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + config.accessTtlSec;
  const jti = crypto.randomUUID();

  const key = await crypto.subtle.importKey(
    'raw',
    config.secret as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'] as KeyUsage[],
  );

  const token = await new SignJWT({
    email: user.email,
    roles: user.roles,
    type: 'access',
    sid: sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(user.userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(key);

  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

/**
 * Verifies an access JWT and returns its claims. Throws on invalid/expired tokens;
 * route middleware maps the thrown error to a 401.
 */
export async function verifyAccessToken(
  config: AuthKeyConfig,
  token: string,
): Promise<AccessTokenClaims> {
  const key = await crypto.subtle.importKey(
    'raw',
    config.secret as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'] as KeyUsage[],
  );

  const { payload } = await jwtVerify(token, key, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ['HS256'],
  });

  if (payload.type !== 'access') {
    throw new Error('Not an access token');
  }

  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Token missing required claims');
  }

  return payload as unknown as AccessTokenClaims;
}

/**
 * Generates a 32-byte opaque refresh token. The raw value is returned to the client;
 * only its SHA-256 hash is persisted in `auth_sessions`.
 */
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

/** SHA-256 hash of an opaque token, returned as base64url for storage/lookup. */
export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
