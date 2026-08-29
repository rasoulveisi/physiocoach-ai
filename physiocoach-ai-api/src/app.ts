import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { createServer } from 'node:http';

import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { adminRouter } from './routes/admin';
import { assessmentsRouter } from './routes/assessments';
import { authRouter } from './routes/auth';
import { exerciseCatalogRouter } from './routes/exercise-catalog';
import { healthRouter } from './routes/health';
import { importRouter } from './routes/import';
import { profilesRouter } from './routes/profiles';
import { workoutPlansRouter } from './routes/workout-plans';
import { workoutSessionsRouter } from './routes/workout-sessions';

type TestableExpressApp = Express & {
  fetch: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
    env?: unknown,
  ) => Promise<globalThis.Response>;
};

export function createApp(): TestableExpressApp {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    req.traceId = req.header('x-request-id') || crypto.randomUUID();
    res.setHeader('x-request-id', req.traceId);
    next();
  });

  app.use(authMiddleware);
  app.use('/api/v1', (req, _res, next) => {
    const aliases: Record<string, string> = {
      '/profiles': '/profile',
      '/workout-plans/active': '/workout-plans/current',
      '/auth/google/exchange': '/auth/oauth/exchange',
      '/exercises': '/exercise-catalog/exercises',
    };
    const queryIndex = req.url.indexOf('?');
    const path = queryIndex >= 0 ? req.url.slice(0, queryIndex) : req.url;
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
    const target = aliases[path];
    if (target) req.url = `${target}${query}`;
    next();
  });
  app.use('/api/v1', healthRouter);
  app.use('/api/v1', authRouter);
  app.use('/api/v1', profilesRouter);
  app.use('/api/v1', assessmentsRouter);
  app.use('/api/v1', workoutPlansRouter);
  app.use('/api/v1', workoutSessionsRouter);
  app.use('/api/v1', exerciseCatalogRouter);
  app.use('/api/v1', importRouter);
  app.use('/api/v1', adminRouter);
  app.use(errorHandler);

  const testableApp = app as unknown as TestableExpressApp;
  testableApp.fetch = async (input, init, bindings) => {
    app.locals.workerEnv = bindings ?? {};
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not start.');
      const source = input instanceof Request ? input : null;
      const inputUrl = source?.url ?? String(input);
      const parsed = new URL(inputUrl, 'http://localhost');
      const requestInit: RequestInit = source
        ? {
            method: source.method,
            headers: source.headers,
            body: source.body,
            duplex: 'half',
          } as RequestInit
        : (init ?? {});
      return await fetch(`http://127.0.0.1:${address.port}${parsed.pathname}${parsed.search}`, requestInit);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };

  return testableApp;
}
