import type { Context, Next } from 'hono';

import { getAuthKeyConfig, type AuthKeyConfig } from '../auth/keys';
import { isSessionActive } from '../auth/sessions';
import { verifyAccessToken } from '../auth/tokens';
import { createDb } from '../db/client';
import type { WorkerBindings } from '../env';
import { createApiError, internalServerError, unauthorized } from '../shared/errors/api';
import type { AuthenticatedUser } from '../types/auth';

function safeHeaderToken(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const [first, ...rest] = tokens;
  if (typeof first !== 'string') {
    return null;
  }

  if (first.toLowerCase() === 'bearer') {
    if (rest.length === 0) {
      return null;
    }

    const [secondToken] = rest;
    if (secondToken?.toLowerCase() === 'bearer') {
      return safeHeaderToken(rest.slice(1).join(' '));
    }

    return rest.join(' ').trim();
  }

  return rest.length > 0 ? null : normalized;
}

function getTokenFromHeader(c: Context): string | null {
  const authHeader = c.req.header('Authorization') ?? c.req.header('authorization');
  if (!authHeader) return null;
  return safeHeaderToken(authHeader);
}

function resolveEnvValue(env: WorkerBindings | undefined, name: string): string | undefined {
  const direct = (env as unknown as Record<string, string | undefined> | undefined)?.[name];
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  if (!env) {
    return undefined;
  }

  const overrideKey = Object.keys(env).find((key) => key.startsWith(`${name}=`));
  if (!overrideKey) {
    return undefined;
  }

  const resolved = overrideKey.slice(name.length + 1);
  return resolved.length > 0 ? resolved : undefined;
}

function isPublicPath(path: string): boolean {
  const normalizedPath = path.replace(/\/+$/, '');

  if (
    normalizedPath === '/api/v1/openapi.json' ||
    normalizedPath === '/api/v1/health' ||
    normalizedPath === '/api/v1/docs' ||
    normalizedPath === '/health'
  ) {
    return true;
  }

  const publicAuthPaths = new Set([
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/oauth/exchange',
    '/api/v1/auth/google/start',
    '/api/v1/auth/google/callback',
  ]);
  if (publicAuthPaths.has(normalizedPath)) {
    return true;
  }

  return (
    normalizedPath.startsWith('/api/v1/auth/oauth/') ||
    normalizedPath.startsWith('/api/v1/auth/verify') ||
    normalizedPath.startsWith('/api/v1/auth/reset')
  );
}

function setAuthContext(c: Context, user: AuthenticatedUser, sessionId?: string): void {
  const setter = c as unknown as { set: (key: string, value: unknown) => void };
  setter.set('authUser', user);
  if (sessionId) {
    setter.set('authSessionId', sessionId);
  }
}

export async function authMiddleware(
  c: Context<{ Bindings: WorkerBindings }>,
  next: Next,
): Promise<Response | void> {
  if (isPublicPath(c.req.path)) {
    return next();
  }

  const env = c.env;
  const appEnv = resolveEnvValue(env, 'APP_ENV');
  const localAuthBypassHeader = c.req.header('x-local-auth-bypass');
  const localAuthBypassToken = resolveEnvValue(env, 'LOCAL_AUTH_BYPASS_TOKEN');
  const devSwaggerBypassHeader = c.req.header('x-dev-swagger');
  const devSwaggerTokenHeader = c.req.header('x-dev-swagger-token');
  const devSwaggerUserId = c.req.header('x-dev-user-id');
  const devSwaggerUserEmail = c.req.header('x-dev-user-email');
  const devSwaggerUserRole = c.req.header('x-dev-user-role');
  const shouldAllowLocalBypass =
    localAuthBypassHeader !== undefined &&
    localAuthBypassToken !== undefined &&
    localAuthBypassHeader === localAuthBypassToken &&
    localAuthBypassHeader.length > 0 &&
    appEnv === 'local';
  const configuredDevSwaggerToken = resolveEnvValue(env, 'DEV_SWAGGER_TOKEN');
  const shouldAllowDevSwaggerBypass =
    devSwaggerBypassHeader === '1' &&
    (appEnv === 'local' ||
      (appEnv === 'dev' &&
        configuredDevSwaggerToken !== undefined &&
        devSwaggerTokenHeader === configuredDevSwaggerToken));

  if (!env || appEnv === 'local' || shouldAllowDevSwaggerBypass || shouldAllowLocalBypass) {
    const userId =
      (shouldAllowDevSwaggerBypass ? devSwaggerUserId : undefined)?.trim() ||
      '00000000-0000-4000-8000-000000000001';
    const email =
      (shouldAllowDevSwaggerBypass ? devSwaggerUserEmail : undefined)?.trim() ||
      'local@physiocoach.dev';
    const localUser: AuthenticatedUser = {
      id: userId,
      email,
      role:
        appEnv === 'dev' && shouldAllowDevSwaggerBypass && devSwaggerUserRole === 'admin'
          ? 'admin'
          : 'user',
      roles:
        appEnv === 'dev' && shouldAllowDevSwaggerBypass && devSwaggerUserRole === 'admin'
          ? ['admin']
          : ['user'],
    };

    setAuthContext(c, localUser, 'local-dev-session');
    return next();
  }

  const token = getTokenFromHeader(c);
  if (!token) {
    return unauthorized(c, 'Missing Authorization header');
  }

  let authConfig: AuthKeyConfig;
  try {
    authConfig = getAuthKeyConfig(env);
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Auth configuration is invalid.';
    return internalServerError(c, 'Auth configuration is invalid.', details);
  }

  let claims: Awaited<ReturnType<typeof verifyAccessToken>>;
  try {
    claims = await verifyAccessToken(authConfig, token);
  } catch {
    return unauthorized(c, 'Invalid or expired auth token');
  }

  const db = getDbClient(env);
  if (!db) {
    return createApiError(c, 'auth_persistence_unavailable', 'Auth persistence is unavailable.');
  }

  let activeSession: boolean;
  try {
    activeSession = await isSessionActive(db, claims.sid, claims.sub);
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Auth session validation failed.';
    return internalServerError(c, 'Auth session validation failed.', details);
  }

  if (!activeSession) {
    return unauthorized(c, 'Invalid or expired auth token');
  }

  const roles = claims.roles.length > 0 ? claims.roles : ['user'];
  const user: AuthenticatedUser = {
    id: claims.sub,
    email: claims.email,
    role: roles.includes('admin') ? 'admin' : 'user',
    roles,
  };

  setAuthContext(c, user, claims.sid);
  return next();
}

function getDbClient(env: WorkerBindings | undefined): ReturnType<typeof createDb> | undefined {
  if (!env?.DB || typeof env.DB !== 'object') {
    return undefined;
  }

  const candidate = env.DB as { prepare?: unknown };
  if (typeof candidate.prepare !== 'function') {
    return undefined;
  }

  return createDb(env.DB);
}
