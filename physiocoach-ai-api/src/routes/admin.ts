import { createExpressRouter } from './express-adapter';
import { getApiRouteContext } from './context';
import { forbidden, handleRouteError, notFound } from '../shared/errors/api';
import {
  deleteExpiredAuditLogs,
  getAuditLogById,
  queryAuditLogs,
} from '../services/ai-audit-logger';

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
  const route = createExpressRouter();

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

  route.get('/ai-audit-logs', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const limitStr = c.req.query('limit');
      const traceId = c.req.query('traceId');
      const task = c.req.query('task');
      const status = c.req.query('status');
      const parsedLimit = limitStr ? Number.parseInt(limitStr, 10) : 20;

      const logs = await queryAuditLogs(db, {
        limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
        ...(traceId ? { traceId } : {}),
        ...(task ? { task } : {}),
        ...(status ? { status } : {}),
      });

      return c.json({ data: logs });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to list AI audit logs.');
    }
  });

  route.get('/ai-audit-logs/:id', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const id = c.req.param('id');
      const log = await getAuditLogById(db, id);

      if (!log) {
        return notFound(c, `AI audit log record not found for id: ${id}`);
      }

      return c.json({ data: log });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch AI audit log record.');
    }
  });

  route.delete('/admin/audit-logs/purge', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!hasAdminRole(user)) {
        return forbidden(c, 'Missing admin role for audit log purge route.');
      }

      const retentionDays = Number.parseInt(c.req.query('days') ?? '7', 10);
      const validRetentionDays = Number.isNaN(retentionDays) ? 7 : retentionDays;
      const deletedCount = await deleteExpiredAuditLogs(db, validRetentionDays);

      return c.json({
        data: {
          purged: true,
          deletedCount,
          retentionDays: validRetentionDays,
          purgedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to purge AI audit logs.');
    }
  });

  return route;
}

export const adminRouter = createAdminRoutes();

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
