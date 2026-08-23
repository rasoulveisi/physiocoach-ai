import { sql } from 'drizzle-orm';
import { Router } from 'express';

import { getDb } from '../db';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res, next) => {
  const startedAt = performance.now();

  try {
    const db = getDb(req.app.locals.workerEnv);
    try {
      await db.execute(sql`select 1`);
    } finally {
      await db.$client.end();
    }

    res.status(200).json({
      ok: true,
      status: 'OK',
      service: 'physiocoach-ai-api',
      uptime: process.uptime(),
      database: { ok: true, responseTimeMs: Math.round(performance.now() - startedAt) },
    });
  } catch (error) {
    next(Object.assign(new Error('Database health check failed.'), { status: 503, cause: error }));
  }
});
