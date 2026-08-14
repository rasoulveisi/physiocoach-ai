import { Hono } from 'hono';

import type { WorkerBindings } from '../env';
import { getApiRouteContext } from './context';
import { forbidden, handleRouteError, notFound } from '../shared/errors/api';

type AuthenticatedUser = ReturnType<typeof getApiRouteContext>['user'];

interface ApiResponse<T> {
  data: T;
}

interface AdminSummary {
  requestedAt: string;
  userId: string;
  canAccessInternalOps: true;
  features: string[];
  dataQuality: {
    plateauDetectionEnabled: boolean;
    trustSignalsTracked: boolean;
    postureAnalysisAvailable: boolean;
  };
}

export function createAdminRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/admin', async (c) => {
    try {
      const { user } = getApiRouteContext(c);
      if (!hasAdminRole(user)) {
        return forbidden(c, 'Missing admin role for /admin route.');
      }

      const response: ApiResponse<AdminSummary> = {
        data: {
          requestedAt: new Date().toISOString(),
          userId: user.id,
          canAccessInternalOps: true,
          features: ['plan-trust-metadata', 'posture-analysis', 'progress-plateau-compliance'],
          dataQuality: {
            plateauDetectionEnabled: true,
            trustSignalsTracked: true,
            postureAnalysisAvailable: true,
          },
        },
      };

      return c.json(response);
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load admin summary.');
    }
  });

  route.get('/admin/health', async (c) => {
    try {
      const { user } = getApiRouteContext(c);
      if (!hasAdminRole(user)) {
        return forbidden(c, 'Missing admin role for /admin/health route.');
      }

      return c.json({
        data: {
          ok: true,
          route: '/admin/health',
          requestedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load admin health summary.');
    }
  });

  route.get('/admin/not-found', async (c) => notFound(c, 'Admin endpoint does not exist.'));

  route.delete('/admin/audit-logs/purge', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!hasAdminRole(user)) {
        return forbidden(c, 'Missing admin role for audit log purge route.');
      }

      const retentionDays = Number.parseInt(c.req.query('days') ?? '7', 10);
      const { deleteExpiredAuditLogs } = await import('../services/ai-audit-logger');
      const deletedCount = await deleteExpiredAuditLogs(
        db,
        Number.isNaN(retentionDays) ? 7 : retentionDays,
      );

      return c.json({
        data: {
          purged: true,
          deletedCount,
          retentionDays: Number.isNaN(retentionDays) ? 7 : retentionDays,
          purgedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to purge AI audit logs.');
    }
  });

  return route;
}

export function hasAdminRole(user: AuthenticatedUser): boolean {
  const normalizedRoles = new Set<string>([
    ...(user.role === undefined ? [] : [user.role.toLowerCase()]),
    ...(user.roles ?? []).map((role) => role.toLowerCase()),
  ]);

  return (
    normalizedRoles.has('admin') ||
    normalizedRoles.has('super_admin') ||
    normalizedRoles.has('internal')
  );
}
