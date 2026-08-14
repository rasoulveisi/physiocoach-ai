import type { WorkerBindings } from './env';
import { DEFAULT_CORS_ORIGIN, isCorsOriginAllowed } from './middleware/cors';

const handler: ExportedHandler<WorkerBindings> = {
  async fetch(request, env, executionContext) {
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }
    console.log('INDEX_FETCH_PATH', request.url, new URL(request.url).pathname);
    if (new URL(request.url).pathname === '/api/v1/health') {
      return Response.json(
        {
          ok: true,
          service: 'physiocoach-ai-api',
          version: '0.1.0',
        },
        { headers: corsHeaders },
      );
    }

    try {
      const { createApp } = await import('./app');
      const response = await createApp().fetch(request, env, executionContext);
      const withCorsHeaders = new Headers(response.headers);

      for (const [header, value] of corsHeaders) {
        withCorsHeaders.set(header, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: withCorsHeaders,
      });
    } catch (error) {
      console.error('Unhandled API request error.', {
        reason: error instanceof Error ? error.message : 'Unknown request error.',
      });

      return Response.json(
        {
          error: {
            code: 'internal_server_error',
            message: 'Unexpected API error.',
          },
        },
        { status: 500, headers: corsHeaders },
      );
    }
  },
  async scheduled(_controller, env, ctx) {
    if (env.DB) {
      const { createDb } = await import('./db/client');
      const { deleteExpiredAuditLogs } = await import('./services/ai-audit-logger');
      const db = createDb(env.DB);
      ctx.waitUntil(deleteExpiredAuditLogs(db, 7));
    }
  },
};

function buildCorsHeaders(request: Request, env: WorkerBindings): Headers {
  const headers = new Headers({
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
  });
  const origin = request.headers.get('Origin');
  const configuredOrigin = env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN;
  if (isCorsOriginAllowed(origin, configuredOrigin)) {
    headers.set('Access-Control-Allow-Origin', origin!);
  }

  return headers;
}

export default handler;
