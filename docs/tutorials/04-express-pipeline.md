# Part 4 — The Express Request Pipeline
### PhysioCoach AI Masterclass (Part 4 of 6)

Express has one idea: **a request flows through an ordered chain of functions**, each of which
may inspect/modify the request, end the response, or pass control onward. Everything else —
routing, validation, auth, error handling — is composition of those functions. This part
dissects the pipeline of a real Express 5 application: assembly, routing, body parsing,
validation, and a centralized error funnel, with every mechanism shown from production code.

---

## 4.1 Application assembly — `src/app.ts` (verbatim)

```ts
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
import { profilesRouter } from './routes/profiles';
import { workoutPlansRouter } from './routes/workout-plans';
import { workoutSessionsRouter } from './routes/workout-sessions';

export function createApp() {
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
  app.use(errorHandler);

  // … test harness elided; see §4.5 …
}
```

### Reading the pipeline

`app.use(fn)` appends a middleware. On each request Express walks the stack in registration
order; each middleware receives `(req, res, next)` and must either call `next()` to continue,
respond to end the flow, or call `next(error)` to skip ahead to error handling.

Trace what each layer contributes, top to bottom:

| Order | Layer | Contribution |
|---|---|---|
| 1 | `cors()` | Emits CORS headers / answers preflight OPTIONS so browsers can call this API cross-origin |
| 2 | `express.json()` | Parses `Content-Type: application/json` bodies into `req.body`; non-JSON bodies pass through untouched |
| 3 | trace-id inline middleware | Stamps `req.traceId` (inbound header or fresh UUID), echoes it as a response header — every log line and error payload downstream can carry it |
| 4 | `authMiddleware` | Verifies JWT and attaches `req.user` (Part 5). Runs *before* routers so every route can assume an authenticated caller |
| 5 | alias rewriter | Rewrites `req.url` for legacy path names — demonstrates middleware as *request transformation*, not merely gating |
| 6–13 | resource routers under `/api/v1` | Terminal handlers: respond and finish |
| 14 | `errorHandler` | Four-argument middleware; catches everything thrown/forwarded by layers above |

**Order is semantics.** Move `express.json()` after the routers and every body arrives
`undefined`. Move `errorHandler` first and it never sees errors (errors propagate downward
only). Put `authMiddleware` after routers and routes execute unauthenticated. When debugging a
pipeline, ask "which layer should have handled this, and did it run?" before anything else.

### Mounting and prefix stripping

`app.use('/api/v1', authRouter)` strips the matched prefix before delegating: inside
`authRouter`, the route registered as `/auth/login` matches the full path
`/api/v1/auth/login`. Routers are themselves middleware — composable, mountable at multiple
prefixes, each carrying its own sub-stack.

---

## 4.2 The smallest complete route — `src/routes/health.ts` (verbatim)

```ts
import { sql } from 'drizzle-orm';
import { Router } from 'express';

import { getDb } from '../db';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res, next) => {
  const startedAt = performance.now();

  try {
    const db = getDb(req.app.locals.workerEnv);
    await db.execute(sql`select 1`);

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
```

Everything worth knowing about a route handler is here:

- **`Router()`** creates an isolated mini-app. `router.get(path, handler)` registers a terminal
  handler for GET on that path.
- **Async handlers are normal**: the route awaits a real DB round-trip (`select 1`) and times
  it. Node's event loop serves other requests while awaiting — concurrency without threads.
- **The error contract:** wrap fallible work in try/catch and forward with
  `next(error)`. The idiom `Object.assign(new Error(...), { status: 503 })` decorates the error
  with an HTTP status that the funnel (§4.4) reads. Unhandled rejection in a wrapped pipeline
  reaches the same place automatically (Express 5 forwards rejected async handlers), but
  explicit forwarding keeps status codes intentional.
- **A health endpoint checks dependencies, not itself:** reporting `database.responseTimeMs`
  makes this a liveness+readiness probe in one.

---

## 4.3 Routes as thin controllers + schema validation

The house style across all routers: parse input with zod → delegate to services/auth modules →
return JSON. Business logic lives outside route files. Two specimens:

`src/routes/validation.ts` (verbatim):

```ts
export async function parseJsonPayload<TSchema extends z.ZodTypeAny>(
  c: ExpressRouteContext,
  schema: TSchema,
): Promise<ParseResult<z.output<TSchema>>> {
  const payload = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false,
      response: invalidRequest(c, 'Request payload failed validation.', {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    };
  }
  return { success: true, data: parsed.data, raw: payload };
}
```

`src/routes/auth.ts` (excerpt):

```ts
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  displayName: z.string().trim().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

Mechanics worth internalizing:

- **Parse, don't validate.** zod transforms unknown input into typed output;
  after `safeParse`, `parsed.data` carries static types (`z.output<TSchema>`), so downstream
  code compiles against validated shapes — no defensive re-checks, no `any`.
- **Discriminated union result:** `{success:true,data}` vs `{success:false,response}` forces
  callers to handle both branches at compile time. The failure branch returns a ready-made 400
  response whose issues list field paths — machine-readable errors the client can map onto form
  fields.
- **Schemas live beside routes** and double as documentation of each endpoint's contract.
  The same library later validates AI-generated payloads before persistence (Part 5).
- Server validation is authoritative regardless of any client-side checks (the web app does
  its own quick regexes for UX only): never trust wire input.

---

## 4.4 The error funnel — `src/middleware/error.ts` (verbatim)

```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { isAuthError } from '../auth/errors';

type HttpError = Error & { status?: number; auditLogId?: string };

const statusTitles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  void next;
  const candidate: HttpError =
    error instanceof Error ? (error as HttpError) : new Error('Unexpected API error.');
  const status =
    error instanceof ZodError
      ? 400
      : isAuthError(error)
        ? error.statusCode
        : typeof candidate.status === 'number' && candidate.status >= 400 && candidate.status < 600
          ? candidate.status
          : 500;

  const traceId = req.traceId || crypto.randomUUID();
  const auditLogId = candidate.auditLogId || req.auditLogId || null;

  if (status >= 500) {
    console.error('request.failed', { traceId, auditLogId, error: candidate.message });
  }

  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: `https://physiocoach.otconnect.ir/problems/${status}`,
      title: statusTitles[status] || 'Request Failed',
      detail: candidate.message || 'Unexpected API error.',
      instance: req.originalUrl,
      traceId,
      auditLogId,
      ...(error instanceof ZodError ? { errors: error.issues } : {}),
    });
};
```

Why a single funnel:

- Route authors throw instead of formatting errors; response shape stays uniform across every
  endpoint; new endpoints inherit correct behavior for free.
- **Classification ladder:** most specific first — zod errors are 400s; domain auth errors know
  their own status; decorated `.status` wins when sane; everything else is 500 and gets logged
  with the trace ID (client-facing messages stay generic for 500s — internal detail leaks via
  logs, not responses).
- The response is RFC 7807 (`application/problem+json`): `type/title/detail/instance` plus
  extensions (`traceId`, `auditLogId`, zod issues). The frontend's `ProblemDetails` interface
  (Part 3) parses exactly this envelope — one contract spanning the whole system.
- `traceId` closes the observability loop stamped back in layer 3 of §4.1: server logs, error
  payloads, and response headers all carry the same ID.

---

## 4.5 The deployment twist: Express over Cloudflare Workers

Read once, late; it changes nothing about day-to-day Express understanding.

`src/index.ts` (verbatim):

```ts
import { httpServerHandler } from 'cloudflare:node';
import { createServer } from 'node:http';
import { createApp } from './app';
import type { WorkerBindings } from './env';

const app = createApp();
const server = createServer(app);
const nodeHandler = httpServerHandler(server);

export default {
  async fetch(request, env, ctx): Promise<Response> {
    app.locals.workerEnv = env;
    return nodeHandler.fetch(request, env, ctx);
  },
};
```

The same `createApp()` also exposes a `.fetch()` method used by integration tests to run real
requests through the full middleware chain without opening a port. Two lessons: (a) keep app
*construction* separate from *listening* so hosts/tests can drive it directly; (b) adapters at
the edges let idiomatic framework code live inside different runtimes.

---

## 4.6 Exercises

1. **Pipeline surgery.** Reorder middlewares three ways — `json()` after routers; `errorHandler`
   first; `authMiddleware` last. For each, predict then observe: what breaks, for which
   requests? Restore.
2. **Status discipline.** In `health.ts`, remove the try/catch and let the DB error throw raw.
   Compare the response (status, body, logs) with the explicit 503 version. Explain what the
   funnel's fallback classification costs you here.
3. **Contract break.** Change `registerSchema` to require `displayName`. Send the old client
   payload; capture the 400's `issues[]` shape. Now write the two-line client change that would
   render those issues next to form fields.
4. **New route, full discipline.** Add `GET /api/v1/ping` returning `{ pong, traceId }` using
   `req.traceId`. Then add `POST /api/v1/echo` validating `{message: z.string().min(1).max(200)}`
   through `parseJsonPayload` and returning the parsed data. Both should need zero error-handling
   code — verify why.
5. **Funnel extension.** Add a custom `DomainError` class with a code→status map and teach the
   funnel about it, following the existing `isAuthError` precedent exactly.

---

## 4.7 Narration check

Without notes: the exact order of the fourteen pipeline layers and each one's contribution; how
prefix mounting works; the async-handler error contract; why parse-don't-validate gives
compile-time safety; the funnel's classification ladder and the RFC 7807 envelope; where
`traceId` originates and everywhere it surfaces.
