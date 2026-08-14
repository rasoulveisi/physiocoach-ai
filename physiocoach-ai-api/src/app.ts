import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { isAuthError } from './auth/errors';
import type { AppVariables, WorkerBindings } from './env';
import { authMiddleware } from './middleware/auth';
import { DEFAULT_CORS_ORIGIN, isCorsOriginAllowed } from './middleware/cors';
import { createApiError, internalServerError, invalidRequest, unauthorized, type ErrorStatusCode } from './shared/errors/api';
import { createAdminRoutes } from './routes/admin';
import { createAssessmentRoutes } from './routes/assessments';
import { createAuthRoutes } from './routes/auth';
import { createExerciseCatalogRoutes } from './routes/exercise-catalog';
import { createHealthRoutes } from './routes/health';
import { createProfileRoutes } from './routes/profiles';
import { createSettingsRoutes } from './routes/settings';
import { createWorkoutPlanRoutes } from './routes/workout-plans';

export function createApp() {
  const app = new Hono<{ Bindings: WorkerBindings; Variables: AppVariables }>();

  app.onError((error, c) => {
    if (
      error instanceof Error &&
      error.message === 'Missing or invalid authenticated user context.'
    ) {
      return unauthorized(c, error.message);
    }

    if (isAuthError(error)) {
      const status: ErrorStatusCode =
        error.statusCode === 401 ||
        error.statusCode === 403 ||
        error.statusCode === 404 ||
        error.statusCode === 409 ||
        error.statusCode === 429
          ? error.statusCode
          : 400;
      const code =
        error.code === 'email_taken'
          ? 'conflict'
          : error.code === 'account_not_found'
            ? 'not_found'
            : error.code === 'rate_limited'
              ? 'rate_limited'
              : status === 401
                ? 'unauthorized'
                : status === 403
                  ? 'forbidden'
                  : 'invalid_request';
      return createApiError(c, code, error.message, { status });
    }

    if (error instanceof ZodError) {
      return invalidRequest(c, 'Validation error.', error.issues);
    }

    if (error instanceof HTTPException) {
      const status: ErrorStatusCode =
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status === 409 ||
        error.status === 429 ||
        error.status === 500 ||
        error.status === 503
          ? error.status
          : 400;
      return createApiError(
        c,
        status === 401
          ? 'unauthorized'
          : status === 403
            ? 'forbidden'
            : status === 404
              ? 'not_found'
              : status === 429
                ? 'rate_limited'
                : status === 409
                  ? 'conflict'
                  : status === 500
                    ? 'internal_server_error'
                    : 'invalid_request',
        error.message || 'HTTP Exception',
        { status },
      );
    }

    return internalServerError(c, 'Unexpected API error.', error.message);
  });

  app.use('*', async (c, next) => {
    const requestId = crypto.randomUUID();
    c.header('x-request-id', requestId);
    c.set('requestId', requestId);
    await next();
  });

  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => {
        const configuredOrigin = c.env?.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN;
        return isCorsOriginAllowed(origin, configuredOrigin) ? origin : undefined;
      },
      allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use('/api/*', authMiddleware);

  app.route('/api/v1', createHealthRoutes());
  app.route('/api/v1', createAuthRoutes());
  app.route('/api/v1', createExerciseCatalogRoutes());
  app.route('/api/v1', createProfileRoutes());
  app.route('/api/v1', createAssessmentRoutes());
  app.route('/api/v1', createAdminRoutes());
  app.route('/api/v1', createWorkoutPlanRoutes());
  app.route('/api/v1', createSettingsRoutes());

  return app;
}
