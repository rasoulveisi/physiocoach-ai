import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { bodyConsiderations } from '../db/schema';
import type { WorkerBindings } from '../env';
import { handleRouteError } from '../shared/errors/api';
import { getApiRouteContext } from './context';

export function createConsiderationRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/considerations', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      if (!db) return c.json({ data: [] });

      const rows = await db
        .select({
          code: bodyConsiderations.code,
          displayName: bodyConsiderations.displayName,
          groupCode: bodyConsiderations.groupCode,
          bodyRegion: bodyConsiderations.bodyRegion,
          kind: bodyConsiderations.kind,
          severityEnabled: bodyConsiderations.severityEnabled,
        })
        .from(bodyConsiderations)
        .where(eq(bodyConsiderations.active, 1))
        .orderBy(asc(bodyConsiderations.groupCode), asc(bodyConsiderations.displayName));

      return c.json({
        data: rows.map((row) => ({ ...row, severityEnabled: row.severityEnabled === 1 })),
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load body considerations.');
    }
  });

  return route;
}
