import type { Context } from 'hono';

import { createDb } from '../db/client';
import type { WorkerBindings } from '../env';
import type { AuthenticatedUser } from '../types/auth';

const REQUEST_ID_HEADER_KEYS = ['x-request-id', 'traceparent'];

export type ApiDbClient = ReturnType<typeof createDb>;

export interface ApiRouteContext {
  requestId: string;
  user: AuthenticatedUser;
  env: Partial<WorkerBindings>;
  db: ApiDbClient | undefined;
}

export function getApiRouteContext(c: Context<{ Bindings: WorkerBindings }>): ApiRouteContext {
  const env = c.env ?? {};
  const requestId = getRequestId(c);
  const resolvedUser = resolveRequestUser(c);

  return {
    requestId,
    user: resolvedUser,
    db: getDbClient(env.DB),
    env,
  };
}

export function hasDbClient(
  context: ApiRouteContext,
): context is ApiRouteContext & { db: ApiDbClient } {
  return context.db !== undefined;
}

function getRequestId(c: Context): string {
  const precomputed = (c as unknown as { get?: (key: string) => unknown }).get?.('requestId');
  if (typeof precomputed === 'string' && precomputed.length > 0) {
    return precomputed;
  }

  for (const headerKey of REQUEST_ID_HEADER_KEYS) {
    const value = c.req.header(headerKey);
    if (!value) continue;

    if (headerKey === 'x-request-id') {
      return value;
    }

    const traceSegment = value.split('-')[2];
    if (traceSegment && traceSegment.length > 0) {
      return traceSegment;
    }
  }

  return crypto.randomUUID();
}

function getDbClient(db: unknown): ApiDbClient | undefined {
  if (!db || typeof db !== 'object') {
    return undefined;
  }

  const candidate = db as { prepare?: unknown };
  if (typeof candidate.prepare !== 'function') {
    return undefined;
  }

  return createDb(db as D1Database);
}

function resolveRequestUser(c: Context): AuthenticatedUser {
  const authUser = (c as unknown as { get?: (key: string) => unknown }).get?.('authUser');
  if (
    authUser &&
    typeof authUser === 'object' &&
    authUser !== null &&
    'id' in authUser &&
    'email' in authUser
  ) {
    const candidate = authUser as AuthenticatedUser;
    if (candidate.id && candidate.email) {
      return candidate;
    }
  }

  const appEnv = c.env?.APP_ENV;
  if (appEnv !== 'local' && appEnv !== undefined) {
    throw new Error('Missing or invalid authenticated user context.');
  }

  const userId = c.req.header('x-user-id') ?? '00000000-0000-4000-8000-000000000001';
  const email = c.req.header('x-user-email') ?? 'local@physiocoach.dev';
  const displayName = c.req.header('x-user-name') ?? undefined;

  return {
    id: userId,
    email,
    ...(displayName === undefined ? {} : { displayName }),
    role: 'user',
    roles: ['user'],
  };
}
