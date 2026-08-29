import { getDb } from '../db';
import type { WorkerBindings } from '../env';
import type { AuthenticatedUser } from '../types/auth';

const REQUEST_ID_HEADER_KEYS = ['x-request-id', 'traceparent'];

import type { ExpressRouteContext } from './express-adapter';

export type ApiDbClient = ReturnType<typeof getDb>;

export interface ApiRouteContext {
  requestId: string;
  user: AuthenticatedUser;
  env: Partial<WorkerBindings>;
  db: ApiDbClient | undefined;
}

type RouteContext = ExpressRouteContext;

export function getApiRouteContext(c: RouteContext): ApiRouteContext {
  const env = c.env ?? {};
  const requestId = getRequestId(c);
  const resolvedUser = resolveRequestUser(c);

  return {
    requestId,
    user: resolvedUser,
    db: getDbClient(c),
    env,
  };
}

export function hasDbClient(
  context: ApiRouteContext,
): context is ApiRouteContext & { db: ApiDbClient } {
  return context.db !== undefined;
}

function getRequestId(c: RouteContext): string {
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

function getDbClient(c: RouteContext): ApiDbClient | undefined {
  try {
    return c.get('db') as ApiDbClient;
  } catch {
    return undefined;
  }
}

function resolveRequestUser(c: RouteContext): AuthenticatedUser {
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

  const userId = c.req.header('x-user-id') ?? '00000000-0000-4000-8000-000000000001';
  const email = c.req.header('x-user-email') ?? 'guest@physiocoach.app';
  const displayName = c.req.header('x-user-name') ?? undefined;

  return {
    id: userId,
    email,
    ...(displayName === undefined ? {} : { displayName }),
    role: 'user',
    roles: ['user'],
  };
}
