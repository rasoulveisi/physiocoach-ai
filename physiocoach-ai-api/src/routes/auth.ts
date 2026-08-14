import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { AuthError, isAuthError } from '../auth/errors';
import { getAuthKeyConfig } from '../auth/keys';
import { hashPassword, isStrongPassword, verifyPassword } from '../auth/password';
import { checkAuthRateLimit } from '../auth/rate-limit';
import {
  createSession,
  getCredentialHashForUser,
  getUserByEmail,
  revokeSession,
  rotateSession,
  toAuthenticatedUser,
  upsertOAuthUser,
  type ResolvedUser,
} from '../auth/sessions';
import { signAccessToken } from '../auth/tokens';
import { createDb } from '../db/client';
import { authCredentials, users } from '../db/schema';
import type { WorkerBindings } from '../env';
import { createApiError, unauthorized } from '../shared/errors/api';
import type { AuthenticatedUser } from '../types/auth';
import { withTransactionFallback } from './transactions';
import { parseJsonPayload } from './validation';

type DbClient = ReturnType<typeof createDb>;

const DUMMY_PASSWORD_HASH =
  'pbkdf2$50000$AAAAAAAAAAAAAAAAAAAAAA==$2ffAJAWDOjK7twSNwuk4ViIEALV8TIAHNuZwB+zAsDo=';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  displayName: z.string().trim().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const oauthExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_OAUTH_SCOPE = 'openid email profile';

export interface PasswordUserInsert {
  userId: string;
  email: string;
  displayName: string | null;
  passwordHash: string;
  now: string;
}

export function createAuthRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.post('/auth/register', async (c) => {
    const parsed = await parseJsonPayload(c, registerSchema);
    if (!parsed.success) return parsed.response;

    const rateLimitResponse = checkAuthRateLimit(c, 'auth:register');
    if (rateLimitResponse) return rateLimitResponse;

    const email = normalizeEmail(parsed.data.email);
    if (!isStrongPassword(parsed.data.password)) {
      return authRouteError(
        c,
        new AuthError(
          'password_too_weak',
          'Password must be at least 8 characters and include a letter and a number.',
        ),
      );
    }

    const db = getAuthDb(c.env);
    if (!db) {
      return createApiError(
        c,
        'invalid_request',
        'Auth persistence is unavailable in this environment.',
      );
    }

    const existing = await getUserByEmail(db, email);
    if (existing) {
      return authRouteError(c, new AuthError('email_taken', 'Email is already registered.'));
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const displayName = parsed.data.displayName ?? null;
    const passwordHash = await hashPassword(parsed.data.password);

    try {
      await createPasswordUser(db, {
        userId,
        email,
        displayName,
        passwordHash,
        now,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return authRouteError(c, new AuthError('email_taken', 'Email is already registered.'));
      }
      throw error;
    }

    return c.json(
      await issueTokenEnvelope(
        db,
        c.env,
        {
          userId,
          email,
          roles: ['user'],
          displayName,
        },
        requestSessionContext(c),
      ),
      201,
    );
  });

  route.post('/auth/login', async (c) => {
    const parsed = await parseJsonPayload(c, loginSchema);
    if (!parsed.success) return parsed.response;

    const rateLimitResponse = checkAuthRateLimit(c, 'auth:login');
    if (rateLimitResponse) return rateLimitResponse;

    const db = getAuthDb(c.env);
    if (!db) {
      return createApiError(
        c,
        'invalid_request',
        'Auth persistence is unavailable in this environment.',
      );
    }

    const user = await getUserByEmail(db, normalizeEmail(parsed.data.email));
    if (!user) {
      await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
      return authRouteError(
        c,
        new AuthError('invalid_credentials', 'Invalid email or password.'),
      );
    }

    const storedHash = await getCredentialHashForUser(db, user.userId);
    if (!(await verifyStoredPasswordForLogin(parsed.data.password, storedHash))) {
      return authRouteError(
        c,
        new AuthError('invalid_credentials', 'Invalid email or password.'),
      );
    }

    return c.json(await issueTokenEnvelope(db, c.env, user, requestSessionContext(c)));
  });

  route.post('/auth/refresh', async (c) => {
    const parsed = await parseJsonPayload(c, refreshSchema);
    if (!parsed.success) return parsed.response;

    const rateLimitResponse = checkAuthRateLimit(c, 'auth:refresh');
    if (rateLimitResponse) return rateLimitResponse;

    const db = getAuthDb(c.env);
    if (!db) {
      return createApiError(
        c,
        'invalid_request',
        'Auth persistence is unavailable in this environment.',
      );
    }

    try {
      const config = getAuthKeyConfig(c.env);
      const rotated = await rotateSession(
        db,
        {
          refreshToken: parsed.data.refreshToken,
          ...requestSessionContext(c),
        },
        config,
      );
      const access = await signAccessToken(
        config,
        {
          userId: rotated.user.userId,
          email: rotated.user.email,
          roles: rotated.user.roles,
        },
        rotated.sessionId,
      );

      return c.json({
        accessToken: access.token,
        refreshToken: rotated.refreshToken,
        sessionId: rotated.sessionId,
        accessExpiresAt: access.expiresAt,
        user: toAuthenticatedUser(rotated.user),
      });
    } catch (error) {
      if (isAuthError(error)) {
        return authRouteError(c, error);
      }
      throw error;
    }
  });

  route.post('/auth/logout', async (c) => {
    const sessionId = (c as unknown as { get?: (key: string) => unknown }).get?.(
      'authSessionId',
    );
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return unauthorized(c, 'Missing authenticated session.');
    }

    const db = getAuthDb(c.env);
    if (!db) {
      return createApiError(
        c,
        'invalid_request',
        'Auth persistence is unavailable in this environment.',
      );
    }

    await revokeSession(db, sessionId);
    return c.json({ success: true });
  });

  route.get('/auth/me', (c) => {
    const user = (c as unknown as { get?: (key: string) => unknown }).get?.('authUser');
    if (!isAuthenticatedUser(user)) {
      return unauthorized(c, 'Missing authenticated user.');
    }

    return c.json({ user });
  });

  route.get('/auth/google/start', async (c) => {
    const config = getGoogleOAuthConfig(c.env);
    const returnTo = resolveOAuthReturnTo(c);

    if (!config) {
      if (c.env.APP_ENV === 'local' || !c.env.APP_ENV) {
        const localReturn = returnTo || 'http://localhost:4300/oauth-callback';
        const targetUrl = new URL(localReturn);
        targetUrl.searchParams.set('code', 'local-dev-code');
        targetUrl.searchParams.set('state', 'local-dev-state');
        return c.json({ authorizationUrl: targetUrl.toString(), state: 'local-dev-state' });
      }
      return createApiError(c, 'invalid_request', 'Google OAuth is not configured.');
    }

    if (!returnTo) {
      return createApiError(c, 'invalid_request', 'OAuth return URL is not allowed.');
    }

    const state = await createOAuthState(c.env, returnTo);
    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPE);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('access_type', 'offline');
    authorizationUrl.searchParams.set('prompt', 'select_account');

    return c.json({ authorizationUrl: authorizationUrl.toString(), state });
  });

  route.get('/auth/google/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code || !state) {
      return createApiError(c, 'invalid_request', 'OAuth callback is missing code or state.');
    }

    try {
      const parsedState = await verifyOAuthState(c.env, state);
      const target = new URL(parsedState.returnTo);
      target.searchParams.set('code', code);
      target.searchParams.set('state', state);
      return c.redirect(target.toString(), 302);
    } catch (error) {
      if (isAuthError(error)) {
        return authRouteError(c, error);
      }
      throw error;
    }
  });

  route.post('/auth/oauth/exchange', async (c) => {
    const parsed = await parseJsonPayload(c, oauthExchangeSchema);
    if (!parsed.success) return parsed.response;

    const config = getGoogleOAuthConfig(c.env);
    const db = getAuthDb(c.env);

    if (parsed.data.code === 'local-dev-code' || (!config && (c.env.APP_ENV === 'local' || !c.env.APP_ENV))) {
      if (db) {
        const user = await upsertOAuthUser(
          db,
          {
            provider: 'google',
            providerUserId: 'local-dev-google-id',
            email: 'local@physiocoach.dev',
            displayName: 'Local Dev User',
          },
          new Date().toISOString(),
        );
        return c.json(await issueTokenEnvelope(db, c.env, user, requestSessionContext(c)));
      }

      const localUser: ResolvedUser = {
        userId: '00000000-0000-4000-8000-000000000001',
        email: 'local@physiocoach.dev',
        displayName: 'Local Dev User',
        roles: ['user'],
      };

      const keyConfig = getAuthKeyConfig(c.env);
      const access = await signAccessToken(keyConfig, localUser, 'local-dev-session');

      return c.json({
        accessToken: access.token,
        refreshToken: 'local-dev-refresh-token',
        sessionId: 'local-dev-session',
        accessExpiresAt: access.expiresAt,
        user: toAuthenticatedUser(localUser),
      });
    }

    if (!config) {
      return createApiError(c, 'invalid_request', 'Google OAuth is not configured.');
    }

    if (!db) {
      return createApiError(
        c,
        'invalid_request',
        'Auth persistence is unavailable in this environment.',
      );
    }

    try {
      await verifyOAuthState(c.env, parsed.data.state);
      const googleTokens = await exchangeGoogleAuthorizationCode(config, parsed.data.code);
      const googleUser = await fetchGoogleUserInfo(googleTokens.accessToken);
      const now = new Date().toISOString();
      const user = await upsertOAuthUser(
        db,
        {
          provider: 'google',
          providerUserId: googleUser.sub,
          email: normalizeEmail(googleUser.email),
          displayName: googleUser.name,
        },
        now,
      );

      return c.json(await issueTokenEnvelope(db, c.env, user, requestSessionContext(c)));
    } catch (error) {
      if (isAuthError(error)) {
        return authRouteError(c, error);
      }
      throw error;
    }
  });

  return route;
}

export async function createPasswordUser(
  db: Pick<DbClient, 'transaction'> & { insert?: unknown },
  user: PasswordUserInsert,
): Promise<void> {
  await withTransactionFallback(
    db,
    async (rawClient) => {
      const client = rawClient as Pick<DbClient, 'insert'>;
      await client.insert(users).values({
        id: user.userId,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.now,
        updatedAt: user.now,
      });
      await client.insert(authCredentials).values({
        id: crypto.randomUUID(),
        userId: user.userId,
        passwordHash: user.passwordHash,
        createdAt: user.now,
        updatedAt: user.now,
      });
    },
    'auth-register',
  );
}

export async function verifyStoredPasswordForLogin(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  return verifyPassword(password, storedHash ?? DUMMY_PASSWORD_HASH);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getAuthDb(env: WorkerBindings | undefined): DbClient | undefined {
  if (!env?.DB || typeof env.DB !== 'object') {
    return undefined;
  }

  const candidate = env.DB as { prepare?: unknown };
  if (typeof candidate.prepare !== 'function') {
    return undefined;
  }

  return createDb(env.DB);
}

function requestSessionContext(c: Context<{ Bindings: WorkerBindings }>) {
  return {
    userAgent: c.req.header('user-agent') ?? null,
    ipHash: null,
  };
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface OAuthStatePayload {
  nonce: string;
  returnTo: string;
  exp: number;
}

interface GoogleTokenResponse {
  accessToken: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string | null;
}

function getGoogleOAuthConfig(env: WorkerBindings): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function resolveOAuthReturnTo(c: Context<{ Bindings: WorkerBindings }>): string | null {
  const requested = c.req.query('returnTo');
  const origin = c.req.header('origin');
  const fallback = origin ? `${origin.replace(/\/$/, '')}/oauth-callback` : null;
  const candidate = requested || fallback;
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (!isAllowedOAuthReturnOrigin(parsed.origin, c.env.CORS_ORIGIN)) {
      return null;
    }

    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function isAllowedOAuthReturnOrigin(origin: string, corsOrigins: string): boolean {
  return corsOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .some((allowed) => allowed === origin || wildcardOriginMatches(allowed, origin));
}

function wildcardOriginMatches(allowed: string, origin: string): boolean {
  if (!allowed.includes('*')) {
    return false;
  }

  try {
    const allowedUrl = new URL(allowed.replace('*.', 'placeholder.'));
    const originUrl = new URL(origin);
    const suffix = allowedUrl.hostname.replace(/^placeholder\./, '');
    return allowedUrl.protocol === originUrl.protocol && originUrl.hostname.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

async function createOAuthState(env: WorkerBindings, returnTo: string): Promise<string> {
  const payload: OAuthStatePayload = {
    nonce: crypto.randomUUID(),
    returnTo,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = await signOAuthState(env, payloadPart);
  return `${payloadPart}.${signature}`;
}

async function verifyOAuthState(env: WorkerBindings, state: string): Promise<OAuthStatePayload> {
  const [payloadPart, signature, extra] = state.split('.');
  if (!payloadPart || !signature || extra !== undefined) {
    throw new AuthError('oauth_state_mismatch', 'OAuth callback state is invalid.');
  }

  const expected = await signOAuthState(env, payloadPart);
  if (!constantTimeEqual(signature, expected)) {
    throw new AuthError('oauth_state_mismatch', 'OAuth callback state is invalid.');
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart)) as OAuthStatePayload;
  } catch {
    throw new AuthError('oauth_state_mismatch', 'OAuth callback state is invalid.');
  }

  if (
    typeof payload.nonce !== 'string' ||
    typeof payload.returnTo !== 'string' ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new AuthError('oauth_state_mismatch', 'OAuth callback state is invalid.');
  }

  let returnOrigin: string;
  try {
    returnOrigin = new URL(payload.returnTo).origin;
  } catch {
    throw new AuthError('oauth_state_mismatch', 'OAuth callback state is invalid.');
  }

  if (!isAllowedOAuthReturnOrigin(returnOrigin, env.CORS_ORIGIN)) {
    throw new AuthError('oauth_state_mismatch', 'OAuth callback state is invalid.');
  }

  return payload;
}

async function signOAuthState(env: WorkerBindings, payloadPart: string): Promise<string> {
  const secret = env.AUTH_JWT_SECRET;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadPart));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string): string {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return diff === 0;
}

async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new AuthError('oauth_exchange_failed', 'Google authorization code exchange failed.');
  }

  return { accessToken: payload.access_token };
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as {
    sub?: unknown;
    email?: unknown;
    name?: unknown;
  } | null;

  if (!response.ok || typeof payload?.sub !== 'string' || typeof payload.email !== 'string') {
    throw new AuthError('oauth_exchange_failed', 'Google user profile could not be loaded.');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}

async function issueTokenEnvelope(
  db: DbClient,
  env: WorkerBindings,
  user: ResolvedUser,
  context: { userAgent: string | null; ipHash: string | null },
) {
  const config = getAuthKeyConfig(env);
  const session = await createSession(db, user.userId, config, context);
  const access = await signAccessToken(
    config,
    {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
    },
    session.sessionId,
  );

  return {
    accessToken: access.token,
    refreshToken: session.refreshToken,
    sessionId: session.sessionId,
    accessExpiresAt: access.expiresAt,
    user: toAuthenticatedUser(user),
  };
}

function authRouteError(c: Context<{ Bindings: WorkerBindings }>, error: AuthError) {
  switch (error.code) {
    case 'email_taken':
      return createApiError(c, 'conflict', error.message);
    case 'invalid_credentials':
    case 'token_expired':
    case 'token_invalid':
    case 'token_revoked':
      return unauthorized(c, error.message);
    case 'account_not_found':
      return createApiError(c, 'not_found', error.message);
    case 'password_too_weak':
    case 'invalid_request':
    case 'oauth_state_mismatch':
    case 'oauth_exchange_failed':
    default:
      return createApiError(c, 'invalid_request', error.message);
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('unique constraint failed');
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { email?: unknown }).email === 'string'
  );
}
