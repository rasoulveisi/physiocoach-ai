import type { NextFunction, Request, Response } from 'express';

import { getAuthKeyConfig } from '../auth/keys';
import { verifyAccessToken } from '../auth/tokens';
import type { WorkerBindings } from '../env';
import type { AuthenticatedUser } from '../types/auth';

declare global {
  // Express uses declaration merging for request-scoped values.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authSessionId?: string;
      traceId?: string;
      auditLogId?: string;
    }
  }
}

function isPublicPath(path?: string): boolean {
  const segment = (path || '').split('?')[0] ?? '';
  const normalized = segment.replace(/\/+$/, '');
  return (
    normalized === '/api/v1/health' ||
    normalized === '/api/v1/openapi.json' ||
    normalized === '/api/v1/docs' ||
    normalized === '/health' ||
    normalized === '/sitemap.xml' ||
    normalized === '/api/v1/sitemap.xml' ||
    normalized === '/robots.txt' ||
    normalized === '/api/v1/robots.txt' ||
    normalized === '/api/v1/auth/register' ||
    normalized === '/api/v1/auth/login' ||
    normalized === '/api/v1/auth/refresh' ||
    normalized === '/api/v1/auth/google' ||
    normalized.startsWith('/api/v1/auth/oauth') ||
    normalized.startsWith('/api/v1/auth/google') ||
    normalized.startsWith('/api/v1/auth/verify') ||
    normalized.startsWith('/api/v1/auth/reset') ||
    normalized.startsWith('/api/v1/exercise-catalog') ||
    normalized.startsWith('/api/v1/explore') ||
    normalized.startsWith('/explore') ||
    (normalized.includes('/workout-plans/') && normalized.endsWith('/ratings'))
  );
}

function bearerToken(req: Request): string | null {
  const value = req.header('authorization')?.trim();
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (isPublicPath(req.originalUrl)) return next();

  try {
    const bindings = (req.app.locals.workerEnv ?? process.env) as unknown as WorkerBindings;
    if (!bindings.APP_ENV || bindings.APP_ENV === 'local') {
      req.user = {
        id: req.header('x-user-id') || '00000000-0000-4000-8000-000000000001',
        email: req.header('x-user-email') || 'local@physiocoach.dev',
        role: 'user',
        roles: ['user'],
      };
      req.authSessionId = 'local-dev-session';
      return next();
    }

    const token = bearerToken(req);
    if (!token) {
      return next(Object.assign(new Error('Missing Authorization header'), { status: 401 }));
    }

    const claims = await verifyAccessToken(getAuthKeyConfig(bindings), token);
    const roles = claims.roles.length > 0 ? claims.roles : ['user'];
    req.user = {
      id: claims.sub,
      email: claims.email,
      role: roles.includes('admin') ? 'admin' : 'user',
      roles,
    };
    req.authSessionId = claims.sid;
    next();
  } catch (error) {
    next(
      Object.assign(error instanceof Error ? error : new Error('Authentication failed.'), {
        status: 401,
      }),
    );
  }
}
