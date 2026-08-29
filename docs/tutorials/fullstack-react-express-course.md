# PhysioCoach AI — Master Full-Stack Course: React 19 + Express 5

A complete, practical course built on the real code in this repository.

- API app: `physiocoach-ai-api/` — Express 5, Drizzle ORM, Postgres (Neon), zod, jose.
- Web app: `physiocoach-ai-web/` — React 19, React Router v7, Vite 6, Tailwind 3.

All file paths below are relative to the repo root (`apps/PhysioCoach Ai/`).
Code blocks marked `(verbatim)` are copied exactly from the named file.
Code blocks marked `(abridged)` show the lines that matter; `…` marks an elision.

## How to use this course

1. Read Modules 1–5 in order. Each module ends with a quick-reference table.
2. Keep both apps open in your editor while you read. Match every snippet to the file.
3. Do the three challenges in Module 6. They are the real test.
4. Finish with the graduation checklist. Every item must be true from memory.

## Course map

| Module | Topic | Core files |
| --- | --- | --- |
| 1 | Architecture and runtime model | `physiocoach-ai-api/src/index.ts`, `physiocoach-ai-web/src/main.tsx` |
| 2 | Express 5 pipeline and error handling | `physiocoach-ai-api/src/app.ts`, `src/middleware/*`, `src/routes/express-adapter.ts` |
| 3 | Data, auth, and AI services | `src/db/*`, `src/auth/*`, `src/services/*` |
| 4 | React 19, Context, Router, hooks, PWA | `physiocoach-ai-web/src/main.tsx`, `src/context/*`, `src/router.tsx` |
| 5 | End-to-end integration | `src/services/api-client.ts`, `physiocoach-ai-web/vite.config.ts` |
| 6 | Hands-on challenges and graduation | your editor |

---

# Module 1 — System Architecture

## 1.1 Two apps, one product

| App | Directory | Stack | Job |
| --- | --- | --- | --- |
| API | `physiocoach-ai-api/` | Express 5, Drizzle, Neon Postgres, zod, jose, Cloudflare Workers | Serves `/api/v1/*`, owns data, auth, AI generation |
| Web | `physiocoach-ai-web/` | React 19, react-router-dom v7, Vite 6, Tailwind 3, Capacitor shell | Athlete UI: dashboard, plan, sessions, settings |

Two deliberate choices in the web app:

- No state library. No Redux, no Zustand, no TanStack Query. State lives in Context plus a hand-written fetch client (`src/services/api-client.ts`).
- One HTTP client. Every server call goes through `apiClient`. There is no second fetch path.

## 1.2 API runtime model: Express inside a Worker

The API is an Express app that runs on Cloudflare Workers. A Worker does not listen on a port; it exports a `fetch` function. The bridge lives in `physiocoach-ai-api/src/index.ts` (verbatim):

```ts
import { httpServerHandler } from 'cloudflare:node';
import { createServer } from 'node:http';

import { createApp } from './app';
import type { WorkerBindings } from './env';

const app = createApp();
const server = createServer(app);
const nodeHandler = httpServerHandler(server as unknown as Parameters<typeof httpServerHandler>[0]);

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    app.locals.workerEnv = env;
    return (nodeHandler as { fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response> }).fetch(
      request,
      env,
      ctx,
    );
  },
};
```

Read this as four steps:

1. `createApp()` builds the Express app once, at module load.
2. `httpServerHandler` wraps the Node `http.Server` so Worker requests can drive it.
3. Every incoming request stores the Worker bindings on `app.locals.workerEnv`.
4. The handler returns a web-standard `Response`.

The bindings carry secrets and config (JWT secret, database URL, OpenRouter key). Routes read them through the request later: `req.app.locals.workerEnv`. This is the only supported way to reach Worker environment values from Express code.

## 1.3 Web runtime model: one root, one provider stack

`physiocoach-ai-web/src/main.tsx` (abridged):

```tsx
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <PreferencesProvider>
          <RouterProvider router={router} />
        </PreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);

// Register PWA Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => { … });
  });
}
```

Facts to memorize:

- `<StrictMode>` double-invokes render and effects in development. This is a detector for impure code, not a bug.
- Provider order matters. `AuthProvider` uses no theme or preference data, but `RestTimerHUD` uses `usePreferences()`, and pages use `useAuth()`. Dependencies flow downward only.
- `RouterProvider` mounts the data router from `src/router.tsx`. Nothing above it re-renders on navigation.
- The service worker registers in production builds only (`public/sw.js`, `public/manifest.webmanifest`).

## 1.4 Repo map — files this course touches

| Layer | File | Role |
| --- | --- | --- |
| API entry | `physiocoach-ai-api/src/index.ts` | Worker `fetch` → Express bridge |
| API assembly | `physiocoach-ai-api/src/app.ts` | Middleware order, router mounting |
| API env | `physiocoach-ai-api/src/env.ts` | zod schema for all bindings |
| API auth middleware | `physiocoach-ai-api/src/middleware/auth.ts` | JWT verify, `req.user` |
| API error funnel | `physiocoach-ai-api/src/middleware/error.ts` | RFC 7807 `application/problem+json` |
| API adapter | `physiocoach-ai-api/src/routes/express-adapter.ts` | Handlers return web `Response` |
| API auth core | `physiocoach-ai-api/src/auth/tokens.ts`, `sessions.ts`, `password.ts`, `keys.ts`, `rate-limit.ts` | JWT, rotation, hashing, limiter |
| API data | `physiocoach-ai-api/src/db/schema.ts`, `db/index.ts`, `db/client.ts` | Drizzle schema and client |
| API routes | `physiocoach-ai-api/src/routes/auth.ts`, `workout-plans.ts`, `workout-sessions.ts` | Auth, plan, session endpoints |
| API AI | `physiocoach-ai-api/src/services/openrouter-provider.ts`, `workout-generator.ts`, `workout-generator/*` | LLM calls, validation, hydration |
| Web entry | `physiocoach-ai-web/src/main.tsx` | Provider stack, SW registration |
| Web router | `physiocoach-ai-web/src/router.tsx` | Route table, guards |
| Web contexts | `physiocoach-ai-web/src/context/AuthContext.tsx`, `ThemeContext.tsx`, `PreferencesContext.tsx` | Global state |
| Web HTTP | `physiocoach-ai-web/src/services/api-client.ts` | Fetch, refresh mutex, GET dedup |
| Web pages | `physiocoach-ai-web/src/pages/PlanPage.tsx`, `SessionPage.tsx`, `OAuthCallbackPage.tsx` | Feature screens |
| Web HUD | `physiocoach-ai-web/src/components/ui/RestTimerHUD.tsx` | Rest timer overlay |

## 1.5 One request, end to end

```
Browser (React 19)
  │  apiClient.post('auth/login', body)
  ▼
fetch('/api/v1/auth/login')            ← src/services/api-client.ts
  │
  ▼  dev: Vite proxy (vite.config.ts)   prod: same-origin origin route
Cloudflare Worker  src/index.ts
  │  app.locals.workerEnv = env
  ▼
Express pipeline  src/app.ts
  cors → express.json → trace-id → authMiddleware → alias rewriter
  → routers (auth, plans, sessions, …) → errorHandler
  ▼
Route handler  src/routes/*.ts
  │  c.get('authUser') / c.get('db')
  ▼
Drizzle query → Neon Postgres        (or OpenRouter for /generate)
  ▼
web Response ← sendWebResponse()     (or problem+json from errorHandler)
  ▼
api-client maps errors → ApiError, stores tokens, dispatches events
  ▼
React context updates → UI re-renders
```

## 1.6 Environment and commands

All API bindings are validated by zod in `physiocoach-ai-api/src/env.ts` (abridged):

```ts
export const envSchema = z.object({
  APP_ENV: z.enum(['local', 'dev', 'production']),
  AUTH_JWT_SECRET: z.string().min(1),
  AUTH_ACCESS_TTL_SEC: z.coerce.number().int().min(60).max(86_400).default(900),
  OPENROUTER_API_KEY: z.string().min(1),
  WORKOUT_MODEL_PRIMARY: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().optional(),
  …
});
```

Values come from three places: `wrangler.jsonc` `vars` (non-secret), Worker secrets (`AUTH_JWT_SECRET`, `OPENROUTER_API_KEY`), and `env.dev.vars` for local dev.

| Task | Command | Directory |
| --- | --- | --- |
| Run API | `npm run dev` (wrangler, port 8787) | `physiocoach-ai-api/` |
| Test API | `npm test` (vitest) | `physiocoach-ai-api/` |
| Full API check | `npm run validate` (lint + test + tsc) | `physiocoach-ai-api/` |
| Run web | `npm run dev` (Vite, port 5173) | `physiocoach-ai-web/` |
| Verify web | `npm run build` (tsc + vite build) | `physiocoach-ai-web/` |
| Generate migration | `npm run db:generate` | `physiocoach-ai-api/` |

### Module 1 quick reference

| Fact | Value |
| --- | --- |
| API host | Cloudflare Worker, Express 5 via `httpServerHandler` |
| Bindings injection | `app.locals.workerEnv = env` per request |
| Web state | Context only; no external store |
| Public API prefix | `/api/v1` |
| Local auth bypass | `APP_ENV=local` trusts `x-user-id` headers |
| Access token TTL | 900 s default (`AUTH_ACCESS_TTL_SEC`) |

---

# Module 2 — The Express 5 Pipeline

## 2.1 Pipeline assembly

`physiocoach-ai-api/src/app.ts` (abridged, order is the whole lesson):

```ts
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
    …
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
  app.use('/api/v1', adminRouter);
  app.use(errorHandler);
```

Every request walks the chain top to bottom. Two rules:

- Anything mounted before `authMiddleware` is public by position. CORS and JSON parsing see every request, including preflights.
- `errorHandler` must be last. Express 5 treats a 4-argument function as the error funnel; errors thrown or passed to `next(error)` anywhere above land here.

The trace middleware is small and worth studying: the client may send `x-request-id`; if absent the API generates one. The same value is echoed back as a response header and embedded in every error body and log line as `traceId`.

## 2.2 Global request augmentation

`physiocoach-ai-api/src/middleware/auth.ts` declares what the pipeline attaches to `req` (verbatim):

```ts
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
```

This is TypeScript declaration merging, not a library feature. After this file loads, `req.user`, `req.traceId`, `req.authSessionId`, and `req.auditLogId` are typed everywhere.

## 2.3 authMiddleware

Same file, `physiocoach-ai-api/src/middleware/auth.ts` (abridged):

```ts
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
    next(Object.assign(error instanceof Error ? error : new Error('Authentication failed.'), {
      status: 401,
    }));
  }
}
```

Mechanics:

| Mechanism | Detail |
| --- | --- |
| Public paths | `isPublicPath()` allowlist: `/health`, `/auth/register|login|refresh|google*|verify*|reset*`, `/openapi.json`, `/docs` |
| Local bypass | `APP_ENV=local` builds `req.user` from `x-user-id` headers — no JWT |
| Real path | `Bearer` token → `verifyAccessToken` → claims onto `req.user`, session id onto `req.authSessionId` |
| Failure | Any throw becomes `next({status: 401})` → error funnel |

Sharp edge: the local bypass makes every protected route "logged in" with a fixed user. Integration tests run this way (`src/app.spec.ts` passes bindings with no `APP_ENV`), so a test that forgets `x-user-id` silently targets user `00000000-…-0001`.

## 2.4 The web-Response adapter

Route files do not touch Express `req`/`res` directly. `physiocoach-ai-api/src/routes/express-adapter.ts` wraps the Express `Router` so handlers return web-standard `Response` objects (abridged):

```ts
export function createExpressRouter(): ExpressRouter {
  const router = Router() as unknown as ExpressRouter;

  for (const method of ['get', 'post', 'patch', 'delete'] as const) {
    const register = Router.prototype[method].bind(router) as …;
    Object.defineProperty(router, method, { value: ((path: string, handler: RouteHandler) =>
      register(path, async (req, res, next) => {
        const context = createRouteContext(req, res);
        try {
          const response = await handler(context);
          await sendWebResponse(res, response);
        } catch (error) {
          next(error);
        } finally {
          await context.closeDb?.();
        }
      })) as RouteMethod });
  }

  return router;
}
```

The context handed to each handler (abridged):

```ts
get: (key) => {
  if (key === 'requestId') return req.traceId;
  if (key === 'authUser') return req.user;
  if (key === 'authSessionId') return req.authSessionId;
  if (key === 'db') {
    db ??= getDb(bindings);
    return db;
  }
  return undefined;
},
```

Why this design:

- Handlers stay Worker-shaped (`Promise<Response>`), matching Cloudflare idioms and making them trivially testable.
- `c.get('db')` is lazy. A route that never touches the database never opens a connection.
- Any throw inside the handler goes to `next(error)` → the error funnel. No per-route try/catch is required, though several routes still add one to shape the response.

## 2.5 Routes as response builders

A representative route from `physiocoach-ai-api/src/routes/workout-sessions.ts` (abridged):

```ts
route.post('/workout-sessions', async (c) => { … });

route.patch('/workout-sessions/:sessionId', async (c) => { … });
```

Error responses come from the shared factory in `physiocoach-ai-api/src/shared/errors/api.ts` (abridged):

```ts
export function createApiError(
  c: ExpressRouteContext,
  code: ErrorCode,
  message: string,
  options: { status?: ErrorStatusCode; details?: unknown } = {},
) {
  const status: ErrorStatusCode = options.status ?? errorStatusByCode(code);
  const payload: { error: ErrorResponsePayload } = {
    error: withRequestId(c, { code, message, … }),
  };
  return c.json(payload, status);
}
```

`c.json()` (adapter) returns `Response.json(body, { status })` — a web Response. `sendWebResponse` later copies its headers and status onto the Express response.

## 2.6 The error funnel

`physiocoach-ai-api/src/middleware/error.ts` (verbatim):

```ts
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
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

Status resolution order — memorize it:

| Priority | Condition | Status |
| --- | --- | --- |
| 1 | `error instanceof ZodError` | 400 |
| 2 | `isAuthError(error)` | `error.statusCode` (from the code map) |
| 3 | error carries a sane `.status` (400–599) | that status |
| 4 | anything else | 500 |

The body is RFC 7807 (`application/problem+json`) plus `traceId` and `auditLogId`. The web client mirrors this envelope in its `ProblemDetails` type — that contract is what makes error handling on both sides uniform.

Auth error codes map to statuses in `physiocoach-ai-api/src/auth/errors.ts` (abridged):

```ts
export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  invalid_credentials: 401,
  email_taken: 409,
  token_expired: 401,
  token_revoked: 401,
  rate_limited: 429,
  …
};
```

## 2.7 Validation

`physiocoach-ai-api/src/routes/validation.ts` (verbatim):

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

  return {
    success: true,
    data: parsed.data,
    raw: payload,
  };
}
```

Call pattern used by every auth route (`src/routes/auth.ts`):

```ts
const parsed = await parseJsonPayload(c, loginSchema);
if (!parsed.success) return parsed.response;
```

Validation is a discriminated union, not an exception. The handler either gets typed `parsed.data` or returns the prepared error Response. Schemas are strict: `workoutSessionCreateSchema` uses `.strict()`, so unknown keys are rejected.

### Module 2 quick reference

| Concept | File | Key fact |
| --- | --- | --- |
| Pipeline order | `src/app.ts` | cors → json → trace → auth → aliases → routers → errorHandler |
| Request identity | `src/middleware/auth.ts` | `req.user`, `req.authSessionId`, `req.traceId` |
| Local bypass | `src/middleware/auth.ts` | `APP_ENV=local` trusts `x-user-id` |
| Handler contract | `src/routes/express-adapter.ts` | return `Response`; `c.get('db')` is lazy |
| Error body | `src/middleware/error.ts` | RFC 7807 + `traceId`, ZodError→400 |
| Status precedence | `src/middleware/error.ts` | Zod > AuthError > `.status` > 500 |
| Validation | `src/routes/validation.ts` | `parseJsonPayload` returns union, not throw |

---

# Module 3 — Data, Auth, and AI Services

## 3.1 Drizzle schema

`physiocoach-ai-api/src/db/schema.ts` uses the Postgres dialect (`drizzle-orm/pg-core`). The `db/migrations/` folder name is misleading history — this is Neon Postgres, not D1 (abridged):

```ts
import { boolean, index, integer, pgTable, primaryKey, real, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

// Refresh-token sessions (rotating, with reuse detection).
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    previousRefreshTokenHash: text('previous_refresh_token_hash'),
    absoluteExpiresAt: text('absolute_expires_at').notNull(),
    idleExpiresAt: text('idle_expires_at').notNull(),
    revokedAt: text('revoked_at'),
    …
  },
  (table) => [
    index('auth_sessions_user_idx').on(table.userId),
    index('auth_sessions_refresh_hash_idx').on(table.refreshTokenHash),
    …
  ],
);
```

Core tables: `users`, `auth_credentials`, `auth_oauth_accounts`, `auth_sessions`, `auth_refresh_token_history`, `profiles`, `assessments`, `workout_plans`, `workout_sessions`, `exercise_logs`, `ai_audit_logs`.

Timestamps are ISO strings in `text` columns (`createdAt`/`updatedAt` via a shared `timestamps` object), not `timestamp` columns. Keep that in mind when comparing dates — always parse.

## 3.2 The database client

`physiocoach-ai-api/src/db/index.ts` (verbatim):

```ts
export function getDb(bindings: Partial<WorkerBindings> = process.env) {
  const connectionString =
    bindings?.HYPERDRIVE?.connectionString ||
    bindings?.DATABASE_URL ||
    (bindings === process.env ? process.env.DATABASE_URL : undefined);

  if (!connectionString) {
    throw new Error('Database connection is not configured.');
  }

  const client = postgres(connectionString, {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
    fetch_types: false,
  });

  return drizzle(client, { schema });
}
```

| Setting | Why |
| --- | --- |
| `HYPERDRIVE?.connectionString` first | Worker Hyperdrive binding wraps the Neon URL |
| `max: 5` | Small pool per isolate; Neon is pooler-fronted |
| `prepare: false` | Required behind poolers/HTTP transports |
| `fetch_types: false` | Skips startup type queries; columns are typed by Drizzle schema |

The per-request flow in the adapter: `c.get('db')` calls `getDb(bindings)` lazily and memoizes it for the life of that request. `physiocoach-ai-api/src/routes/context.ts` exposes the assembled view via `getApiRouteContext(c)` returning `{ requestId, user, env, db }`, and `hasDbClient(context)` narrows `db` to present.

Workflow: edit `src/db/schema.ts` → `npm run db:generate` → apply migration → restart. `drizzle.config.ts` points at `./src/db/schema.ts` with output `./src/db/migrations`.

## 3.3 Password hashing

`physiocoach-ai-api/src/auth/password.ts` — PBKDF2-SHA256 via Web Crypto (abridged):

```ts
const ITERATIONS = 50_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export function isStrongPassword(password: string): boolean {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return false;
  }
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `${FORMAT_PREFIX}$${ITERATIONS}$${base64Encode(salt)}$${base64Encode(hash)}`;
}
```

Storage format: `pbkdf2$50000$<b64-salt>$<b64-hash>`. Comparison is a hand-rolled timing-safe loop (`timingSafeEqual` XORs fixed-length buffers).

## 3.4 Access tokens

`physiocoach-ai-api/src/auth/tokens.ts` — HS256 JWT via `jose` (abridged):

```ts
export async function signAccessToken(
  config: AuthKeyConfig,
  user: AuthUserClaims,
  sessionId: string,
): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + config.accessTtlSec;
  const jti = crypto.randomUUID();
  const key = await crypto.subtle.importKey('raw', config.secret as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'] as KeyUsage[]);

  const token = await new SignJWT({ email: user.email, roles: user.roles, type: 'access', sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(user.userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(key);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}
```

Verification pins everything (abridged):

```ts
const { payload } = await jwtVerify(token, key, {
  issuer: config.issuer,
  audience: config.audience,
  algorithms: ['HS256'],
});
if (payload.type !== 'access') throw new Error('Not an access token');
```

Claims: `sub` (user id), `sid` (session id), `email`, `roles[]`, `type: 'access'`, plus standard `iss/aud/exp/jti`. The `sid` claim is the design center: it binds the stateless JWT to a revocable `auth_sessions` row.

## 3.5 Sessions and refresh rotation

`physiocoach-ai-api/src/auth/sessions.ts`. Refresh tokens are opaque 32-byte random strings; the client holds the raw value, the database stores only a SHA-256 hash (`hashToken`). Creation (abridged):

```ts
export async function createSession(
  db: ApiDbClient,
  userId: string,
  config: { refreshIdleDays: number; refreshAbsoluteDays: number },
  context: Pick<SessionContext, 'userAgent' | 'ipHash'>,
): Promise<CreatedSession> {
  const now = new Date();
  const { generateRefreshToken } = await import('./tokens');
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const sessionId = crypto.randomUUID();

  const absoluteExpiresAt = new Date(now.getTime() + config.refreshAbsoluteDays * 86_400_000);
  const idleExpiresAt = new Date(now.getTime() + config.refreshIdleDays * 86_400_000);

  await db.insert(authSessions).values({ id: sessionId, userId, refreshTokenHash, … });
  await recordRefreshTokenHistory(db, sessionId, refreshTokenHash, now.toISOString());
  return { sessionId, refreshToken, absoluteExpiresAt, idleExpiresAt };
}
```

Rotation with reuse detection — the heart of the module (abridged):

```ts
export async function rotateSession(
  db: ApiDbClient,
  context: SessionContext,
  config: { refreshIdleDays: number; refreshAbsoluteDays: number },
): Promise<RotatedSession> {
  const presentedHash = await hashToken(context.refreshToken);
  …
  const session = matches[0];

  if (!session) {
    // Hash not current → maybe an OLD token is being replayed.
    const historyMatches = await db
      .select({ sessionId: authRefreshTokenHistory.sessionId })
      .from(authRefreshTokenHistory)
      .where(eq(authRefreshTokenHistory.tokenHash, presentedHash))
      .limit(1);
    …
    if (historicalSession && !isSessionExpired(historicalSession, now)) {
      await revokeSession(db, historicalSession.id, nowIso);   // compromise signal
    }
    throw new AuthError('token_invalid', 'Refresh token is not valid.');
  }

  if (session.revokedAt !== null) throw new AuthError('token_revoked', 'Session has been revoked.');
  if (isSessionExpired(session, now)) { … throw new AuthError('token_expired', …); }

  // Mint the next refresh token, sliding the idle window.
  const nextRefresh = generateRefreshToken();
  const nextHash = await hashToken(nextRefresh);
  const nextIdle = new Date(now.getTime() + config.refreshIdleDays * 86_400_000);

  const updated = await db.update(authSessions)
    .set({ refreshTokenHash: nextHash, previousRefreshTokenHash: presentedHash, idleExpiresAt: nextIdle.toISOString() })
    .where(and(eq(authSessions.id, session.id), eq(authSessions.refreshTokenHash, presentedHash), isNull(authSessions.revokedAt)))
    .returning({ id: authSessions.id });

  if (updated.length === 0) {
    await revokeSession(db, session.id, nowIso);
    throw new AuthError('token_invalid', 'Refresh token is not valid.');
  }
  …
}
```

Three defenses live in this one function:

1. Reuse detection — every issued hash lands in `auth_refresh_token_history`. Presenting a stale hash revokes the whole session.
2. Conditional update — the `WHERE` re-checks `refreshTokenHash = presentedHash`, so two concurrent refreshes cannot both win. The loser revokes the session.
3. Dual expiry — sliding `idleExpiresAt` (refreshed on each rotation) plus hard `absoluteExpiresAt`.

Session expiry model:

| Field | Resets on activity | Meaning |
| --- | --- | --- |
| `idleExpiresAt` | yes, each rotation | 30 days of inactivity kills the session |
| `absoluteExpiresAt` | no | 60 days max lifetime, then forced re-login |
| `revokedAt` | — | set on logout, reuse detection, or `revokeAllSessions` |

## 3.6 Login route, timing safety, rate limit

`physiocoach-ai-api/src/routes/auth.ts` (abridged):

```ts
const DUMMY_PASSWORD_HASH = 'pbkdf2$50000$AAAAAAAAAAAAAAAAAAAAAA==$2ffAJAWDOjK7twSNwuk4ViIEALV8TIAHNuZwB+zAsDo=';

route.post('/auth/login', async (c) => {
  const parsed = await parseJsonPayload(c, loginSchema);
  if (!parsed.success) return parsed.response;

  const rateLimitResponse = checkAuthRateLimit(c, 'auth:login');
  if (rateLimitResponse) return rateLimitResponse;
  …
  const user = await getUserByEmail(db, normalizeEmail(parsed.data.email));
  if (!user) {
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    return authRouteError(c, new AuthError('invalid_credentials', 'Invalid email or password.'));
  }
  …
});
```

For an unknown email the API still runs a full PBKDF2 verify against a fixed dummy hash. Response time is constant whether or not the user exists, so response timing cannot enumerate emails.

`physiocoach-ai-api/src/auth/rate-limit.ts` — fixed-window limiter (abridged):

```ts
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_ATTEMPTS = 5;
const authBuckets = new Map<string, AuthRateLimitBucket>();

export function checkAuthRateLimit(c: ExpressRouteContext, routeKey: string): Response | null {
  const now = Date.now();
  const key = `${routeKey}:${getClientKey(c)}`;
  …
  bucket.count += 1;
  authBuckets.set(key, bucket);
  pruneExpiredBuckets(now);

  if (bucket.count <= AUTH_MAX_ATTEMPTS) return null;

  c.header('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
  return createApiError(c, 'rate_limited', 'Too many auth attempts. Please retry shortly.');
}
```

5 attempts per minute per IP (`cf-connecting-ip` → `x-forwarded-for` → `x-real-ip`). The map lives in the isolate's memory — a honest trade-off: no shared store, but the limiter resets when the isolate restarts. Successful register/login/refresh return the same envelope via `issueTokenEnvelope` (`src/routes/auth.ts`): `accessToken`, `refreshToken`, `sessionId`, `accessExpiresAt`, `user`.

## 3.7 AI workout generation

The generation pipeline, `physiocoach-ai-api/src/services/workout-generator.ts` + `workout-generator/*`:

```
POST /workout-plans/generate                    (routes/workout-plans.ts)
  1. resolve assessment   body → DB (latest) → safe defaults
  2. resolve profile      body → DB (latest) → safe defaults
  3. buildPlanInputHash   deterministic SHA hash of inputs
  4. createWorkoutPlanProvider(env)
  5. generateWorkoutPlanWithSafety(...)
       prompt-builder → provider → parse → hydrate → validate
  6. buildWorkoutPlanRecord + parseWorkoutPlanRecordOrError
  7. persistAssessmentAndPlan → 200 { data: { …dto, inputHash, cached } }
```

Provider selection in `physiocoach-ai-api/src/services/workout-generator/config.ts` (abridged): Google AI Studio for `gemini-*`/native `gemma-*` models, OpenRouter for everything else; a provider missing its API key is replaced by `createUnavailableProvider`, which throws a clear message.

The LLM call (OpenRouter path, abridged) pins the model, timeout, and JSON contract:

```ts
const response = await fetch(`${input.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${input.apiKey}`,
    'HTTP-Referer': input.referer,
    'X-Title': input.title,
  },
  body: JSON.stringify({
    model: input.model,
    ...(input.forceFresh ? { seed: Math.floor(Math.random() * 1_000_000_000) } : {}),
    messages: [
      { role: 'system', content: WORKOUT_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: input.prompt },
    ],
    ...(input.model.includes('nemotron') ? {} : { response_format: { type: 'json_object' } }),
    temperature: 0.2,
    max_tokens: 6000,
    stream: false,
  }),
  ...(controller ? { signal: controller.signal } : {}),
});
```

Defaults (`src/services/workout-generator/config.ts`): primary `z-ai/glm-5.2:free`, fallbacks `minimax/minimax-m3:free`, `gemini-3.7-flash`, …; timeout 15 s; retries capped at 0. The allowlist (`ALLOWED_WORKOUT_MODELS`) blocks arbitrary model strings from env.

Never trust model output. Two defense layers:

- Repair: `physiocoach-ai-api/src/services/workout-generator/plan-hydration.ts` normalizes AI key variants (`day_no`, `rest_seconds`, string numbers) via `z.preprocess`, matches names to catalog entries (`matchExerciseToCatalog`), and counts `corrections` / `repaired`.
- Validation: `physiocoach-ai-api/src/services/plan-validator.ts` enforces safety clusters — `MAX_AMBER_PER_DAY = 1`, red-cluster exercises are rejected outright.

Every AI call is audited with tokens and latency: `logAiAuditEntry` in `physiocoach-ai-api/src/services/ai-audit-logger.ts` writes `ai_audit_logs` rows with `status: 'success' | 'error' | 'schema_rejected'`, `promptTokens`, `completionTokens`, `latencyMs`. Generation failure surfaces as HTTP 409 `workout_plan_generation_failed` with the `traceId` in details (`src/routes/workout-plans.ts`).

### Module 3 quick reference

| Concept | File | Key fact |
| --- | --- | --- |
| Schema | `src/db/schema.ts` | `pg-core`; ISO text timestamps |
| Client | `src/db/index.ts` | `postgres.js`, `max:5`, `prepare:false` |
| Lazy per-request DB | `src/routes/express-adapter.ts` | `c.get('db')` memoizes per request |
| Passwords | `src/auth/password.ts` | PBKDF2 50k, dummy-hash login |
| Access JWT | `src/auth/tokens.ts` | HS256, iss/aud pinned, `sid` claim |
| Refresh rotation | `src/auth/sessions.ts` | hash-only storage, reuse → revoke |
| Rate limit | `src/auth/rate-limit.ts` | 5/min/IP, in-memory fixed window |
| AI provider | `src/services/workout-generator/config.ts` | Google native vs OpenRouter routing |
| AI trust boundary | `src/services/plan-validator.ts` | amber cap, red reject, audit row per call |

---

# Module 4 — React 19 Frontend

## 4.1 The execution model you must internalize

React 19 runs every UI update through the same loop:

```
render (call components, must be pure) → commit (mutate the DOM) → effects (run after paint)
```

Consequences visible in this codebase:

- A component body may run many times. It must not fetch, mutate, or schedule side work — that belongs in effects or event handlers.
- `<StrictMode>` in `src/main.tsx` intentionally mounts, unmounts, and remounts every component and double-runs effects in development. A missing effect cleanup shows up as a doubled timer or doubled fetch here, not in production.
- State updates are requests, not assignments. `setSeconds(s + 1)` twice in one handler adds 1, not 2; use the updater form `setSeconds((s) => s + 1)`.

There is no class component, no `componentDidMount`, no `forceUpdate` anywhere in `physiocoach-ai-web/src`. The whole app is function components + hooks.

## 4.2 Context API — the state layer

The app replaces a state library with three contexts. All follow the same shape:

```tsx
const SomeContext = createContext<Value | undefined>(undefined);

export function SomeProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(…);
  // effects for persistence / sync
  return <SomeContext.Provider value={value}>{children}</SomeContext.Provider>;
}

export function useSome(): Value {
  const context = useContext(SomeContext);
  if (!context) throw new Error('useSome must be used inside SomeProvider.');
  return context;
}
```

The `undefined` default + throw is the guard against consuming a context without its provider. Memorize it — it is the pattern for any context you add.

| Context | File | State | Persistence |
| --- | --- | --- | --- |
| Theme | `src/context/ThemeContext.tsx` | `'light' \| 'dark' \| 'system'` | `localStorage: physiocoach_theme` + `matchMedia` listener |
| Auth | `src/context/AuthContext.tsx` | `token`, `user`, `isRestoring` | `localStorage` via `api-client` keys |
| Preferences | `src/context/PreferencesContext.tsx` | units, rest seconds, sound, auto-start | `localStorage: pc_*` keys |

`ThemeContext.tsx` (verbatim, it is tiny):

```tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme | null) || 'system');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply();
    media.addEventListener('change', apply);
    localStorage.setItem(THEME_KEY, theme);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

Note the lazy `useState` initializer (runs once, not every render) and the cleanup that removes the media listener. `PreferencesContext.tsx` uses the same initializer trick to read each `pc_*` key exactly once at mount.

## 4.3 AuthContext — the most instructive provider

`physiocoach-ai-web/src/context/AuthContext.tsx` (abridged, comments from source):

```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Sync React state with silent background refreshes performed by api-client.
  // Declared before the restore effect so listeners are active while it verifies the session.
  useEffect(() => {
    const handleSessionUpdated = (event: Event) => {
      const data = (event as CustomEvent<Partial<AuthSession>>).detail;
      if (!data?.accessToken) return;
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
    };
    const handleSessionExpired = () => { setToken(null); setUser(null); };
    window.addEventListener('auth:session-updated', handleSessionUpdated);
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-updated', handleSessionUpdated);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  // Startup restore: hydrate from storage, then verify the access token against the API.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      setToken(storedToken);
      setUser(readStoredUser());

      if (storedToken) {
        try {
          const { user: verified } = await apiClient.get<{ user: User }>('auth/me');
          if (!cancelled && verified) {
            setUser(verified);
            localStorage.setItem(USER_KEY, JSON.stringify(verified));
          }
        } catch {
          /* Stale session: api-client already cleared storage and dispatched auth:session-expired. */
        }
      }
      if (!cancelled) setIsRestoring(false);
    };
    void restore();
    return () => { cancelled = true; };
  }, []);
  …
}
```

Design points worth stealing:

1. Two orthogonal concerns, two effects: listener wiring (once) and async restore (once, cancellable).
2. `isRestoring` starts `true` so the router can hold the UI until the token check finishes — no flicker between "logged out" and "logged in".
3. The context is not the only writer. `api-client` silently refreshes tokens and announces changes through `window` CustomEvents; the provider listens. Events decouple the HTTP layer from React.
4. Mutations are wrapped in `useCallback` and the provider value in `useMemo` with the full dependency list — any consumer re-renders only when something actually changed.

## 4.4 React Router v7 — data router and layout-route guards

`physiocoach-ai-web/src/router.tsx` (verbatim):

```tsx
export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
}

export function PublicRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/auth', element: <AuthPage /> },
    ],
  },
  { path: '/oauth-callback', element: <OAuthCallbackPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <App />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          { path: '/assessment', element: <AssessmentPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/plan', element: <PlanPage /> },
          { path: '/session', element: <SessionPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/admin', element: <AdminPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
```

Guards are layout routes: pathless parents whose element renders `<Outlet/>` or redirects. A guard decision covers every child — no per-page `useEffect` redirects. Three sharp edges:

- `<Navigate replace />` keeps the back button honest (post-login back does not return to `/auth`).
- `/oauth-callback` sits outside both guards: it must render while unauthenticated and complete the session itself.
- The guard renders `<Loading/>` while `isRestoring` — redirecting before restore finishes would bounce every refresh of a protected page to `/auth`.

The shell is `src/App.tsx`: desktop navbar / `<Outlet />` / mobile bottom nav inside a `h-[100dvh]` flex column.

## 4.5 Async data fetching pattern

No data-fetching library. Pages own their loading/error state. `physiocoach-ai-web/src/pages/PlanPage.tsx` (abridged):

```tsx
const [planView, setPlanView] = useState<WorkoutPlanView | null>(null);
const [loading, setLoading] = useState(true);
const [generating, setGenerating] = useState(false);
const [error, setError] = useState('');
const [toast, setToast] = useState<… | null>(null);

const fetchCurrentPlan = useCallback(async () => {
  setLoading(true);
  setError('');
  try {
    const res = await apiClient.get<any>('workout-plans/current');
    const payload = res?.data || res;
    if (payload && payload.plan && Array.isArray(payload.plan.days)) {
      setPlanView(payload);
      …
    } else {
      setPlanView(null);
    }
  } catch (cause) {
    console.warn('Could not fetch active plan:', cause);
    setPlanView(null);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  fetchCurrentPlan();
}, [fetchCurrentPlan]);
```

The recurring template:

1. `useCallback` wraps the async function so the effect dependency is stable.
2. `useEffect` triggers it; `finally` guarantees the loading flag clears.
3. Errors become state (`error`, `toast`), never thrown into render.
4. Guard the payload shape before trusting it (`payload.plan && Array.isArray(...)`).

`generating` is a separate flag from `loading` so the generate button can spin while cached-plan loading does not block it. Long generation (LLM round trip) is a plain `await apiClient.post('workout-plans/generate', …)` inside `generateNewPlan` — no SSE, no polling.

## 4.6 Custom hooks in practice

Custom hooks in this codebase live inside their domains, not a `hooks/` folder:

- `useAuth()` — `src/context/AuthContext.tsx`
- `useTheme()` — `src/context/ThemeContext.tsx`
- `usePreferences()` — `src/context/PreferencesContext.tsx`
- Component-scoped behavior stays in the component (e.g. `PlanPage` swipe handler with `useRef` touch coordinates).

The extraction rule: the moment two components need the same `useState`+`useEffect` pair, lift the pair into a custom hook and return a typed object. The HUD below shows the canonical timer hook shape.

## 4.7 RestTimerHUD — effects, refs, and the PWA HUD

`physiocoach-ai-web/src/components/ui/RestTimerHUD.tsx` is the best effect specimen in the app (abridged):

```tsx
const { soundEnabled, setSoundEnabled } = usePreferences();
const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
const [isRunning, setIsRunning] = useState(autoStart);
const [isFinished, setIsFinished] = useState(false);
const finishedFiredRef = useRef(false);

useEffect(() => {
  setTotalSeconds(initialSeconds);
  setRemainingSeconds(initialSeconds);
  if (autoStart) {
    setIsRunning(true);
    setIsFinished(false);
    finishedFiredRef.current = false;
  }
}, [initialSeconds, autoStart]);

useEffect(() => {
  if (!isRunning) return;

  const timer = setInterval(() => {
    setRemainingSeconds((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        setIsRunning(false);
        setIsFinished(true);
        if (!finishedFiredRef.current) {
          finishedFiredRef.current = true;
          if (soundEnabled) soundCueService.playTimerCompleteChime();
          if (onFinished) onFinished();
        }
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [isRunning, soundEnabled, onFinished]);
```

Every lesson about effects in one component:

| Concern | Solution in source |
| --- | --- |
| Ticking without drift-prone closures | updater form `setRemainingSeconds((prev) => …)` |
| Interval lifecycle | `clearInterval` in cleanup, re-created when deps change |
| Side effects exactly once on finish | `finishedFiredRef` — a `useRef` flag survives StrictMode remounts |
| Props changing mid-run | first effect resets state from `initialSeconds`/`autoStart` |
| Toggling sound | `soundEnabled` in deps → interval restarts (acceptable: 1 s cadence) |

The render side is a fixed-position overlay: SVG ring with `strokeDashoffset` math (`circumference = 2πr`, offset = remaining fraction), `tabular-nums` mono digits, control strip (`-15s`, `+30s`, Pause/Resume, Skip). It reads unit/sound/auto-start config from `usePreferences()` — the contexts compose: Preferences feeds HUD, Auth feeds router, Theme feeds document class.

PWA wiring lives at the edges: `public/manifest.webmanifest` + `public/sw.js`, registered in `src/main.tsx` only when `process.env.NODE_ENV === 'production'`, with `registration.onupdatefound` logging "New PhysioCoach version ready. Refresh to update."

### Module 4 quick reference

| Concept | File | Key fact |
| --- | --- | --- |
| Root stack | `src/main.tsx` | Theme → Auth → Preferences → RouterProvider |
| Context guard | all three contexts | `undefined` default + throw in hook |
| Auth restore | `src/context/AuthContext.tsx` | `isRestoring` gate; verify via `auth/me` |
| Cross-layer sync | `AuthContext` ↔ `api-client` | `auth:session-updated` / `auth:session-expired` events |
| Guards | `src/router.tsx` | layout routes + `<Outlet/>`, `<Navigate replace>` |
| Fetch pattern | `src/pages/PlanPage.tsx` | `useCallback` + effect + `finally` + shape guard |
| Timer effects | `src/components/ui/RestTimerHUD.tsx` | updater form, cleanup, `useRef` once-flag |

---

# Module 5 — End-to-End Integration

## 5.1 API base URL resolution

`physiocoach-ai-web/src/services/api-client.ts` (verbatim):

```ts
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/api/v1';
  }
  return 'https://physiocoach-ai-api.otconnect.ir/api/v1';
}
```

Three tiers, first match wins: explicit `VITE_API_URL` → relative `/api/v1` on localhost → production API origin.

## 5.2 The Vite proxy

`physiocoach-ai-web/vite.config.ts` (verbatim):

```ts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } } },
});
```

In dev the browser calls same-origin `/api/v1/...` on :5173. Vite forwards `/api/*` to the wrangler dev server on :8787. Because the request is same-origin, no CORS is involved at all. The API's `CORS_ORIGIN` config matters only for cross-origin deployments (or Capacitor builds). To run the pair locally:

| Step | Command | Port |
| --- | --- | --- |
| 1 | `npm run dev` in `physiocoach-ai-api/` | 8787 |
| 2 | `npm run dev` in `physiocoach-ai-web/` | 5173 |
| 3 | Open `http://localhost:5173` | — |

## 5.3 The single HTTP client

`physiocoach-ai-web/src/services/api-client.ts` is ~180 lines doing four jobs (abridged request core):

```ts
async function sendRequest(path: string, method: string, options: ApiRequestOptions, token: string | null): Promise<AuthAttempt> {
  const { body, headers, ...init } = options;
  const response = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, {
    ...init,
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = (response.headers.get('content-type') || '').includes('json');
  const payload: unknown = isJson ? await response.json() : await response.text();
  return { response, payload };
}
```

Error envelope mirrors the server's RFC 7807 body:

```ts
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
  }
}
```

Session-lifecycle paths are excluded from the refresh flow:

```ts
const SESSION_PATHS = new Set(['auth/login', 'auth/register', 'auth/refresh']);
```

## 5.4 Silent refresh: single-flight mutex

`physiocoach-ai-web/src/services/api-client.ts` (verbatim, the load-bearing part):

```ts
// Silent refresh mutex: at most one /auth/refresh call in flight; concurrent 401s join the shared promise.
let refreshPromise: Promise<string | null> | null = null;

async function performSilentRefresh(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearStoredTokens();
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return null;
    }

    const attempt = await sendRequest('auth/refresh', 'POST', { body: { refreshToken }, token: null }, null);
    const data: RefreshResponse = typeof attempt.payload === 'object' && attempt.payload !== null ? attempt.payload : {};
    if (!attempt.response.ok || !data.accessToken) {
      throw new Error(toProblem(attempt.payload, attempt.response).detail || 'Silent refresh failed.');
    }

    localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    if (data.user !== undefined && data.user !== null) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('auth:session-updated', { detail: data }));
    return data.accessToken;
  } catch {
    clearStoredTokens();
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    return null;
  } finally {
    refreshPromise = null;
  }
}

function requestSilentRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performSilentRefresh();
  }
  return refreshPromise;
}
```

Why the mutex exists: the access token lives 900 s. When it expires, several parallel requests fail with 401 at once. Without coordination each would call `/auth/refresh`. But the server rotates refresh tokens (Module 3.5) — the second `/auth/refresh` presents an already-used token, and reuse detection would revoke the session. The shared `refreshPromise` makes every 401 await the same single refresh; all losers retry with the new token.

## 5.5 The 401 retry loop

Same file (verbatim):

```ts
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const allowRefresh = !isSessionPath(path);
  const token = options.token !== undefined ? options.token : localStorage.getItem(AUTH_TOKEN_KEY);
  const cacheKey = method === 'GET' ? `${token || 'anon'}:${path}` : null;

  if (cacheKey && inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey)! as Promise<T>;
  }

  const promise = (async () => {
    try {
      let attempt = await sendRequest(path, method, options, token);

      if (attempt.response.status === 401 && allowRefresh) {
        const refreshedToken = await requestSilentRefresh();
        if (refreshedToken) {
          attempt = await sendRequest(path, method, options, refreshedToken);
        }
      }

      if (!attempt.response.ok) {
        throw new ApiError(toProblem(attempt.payload, attempt.response));
      }

      return attempt.payload as T;
    } finally {
      if (cacheKey) {
        inFlightGets.delete(cacheKey);
      }
    }
  })();

  if (cacheKey) {
    inFlightGets.set(cacheKey, promise);
  }

  return promise;
}
```

Read it as a state machine:

```
sendRequest → 401? ──no──→ ok? ──yes─→ payload
     │yes                    │no
     ▼                       ▼
requestSilentRefresh()    throw ApiError(ProblemDetails)
     │got token?
     ├─yes→ resend once → ok/throw
     └─no─→ throw ApiError   (event listeners have already cleared state)
```

Also note the GET dedup: an in-flight GET for `token:path` returns the same promise to duplicate callers. This is why two components fetching the same plan do not double-fetch.

## 5.6 Auth lifecycle, end to end

Events are the bridge between the HTTP layer and React (`AuthContext` listens, Module 4.3):

| Event | Dispatched by | Provider reaction |
| --- | --- | --- |
| `auth:session-updated` | `performSilentRefresh` success | `setToken`, maybe `setUser` |
| `auth:session-expired` | refresh failure or missing refresh token | `setToken(null)`, `setUser(null)` → guards redirect |

Sign-in round trip (email/password):

```
AuthPage → login() → apiClient.post('auth/login', body, { token: null })
  → API: parseJsonPayload → rate limit → getUserByEmail → PBKDF2 verify
  → issueTokenEnvelope: createSession + signAccessToken
  → { accessToken, refreshToken, sessionId, accessExpiresAt, user }
  → storeSession(): localStorage × 3 keys + setState
  → router guard flips → Navigate to /dashboard
```

Refresh round trip (invisible unless you watch the network tab):

```
any 401 → requestSilentRefresh() → POST auth/refresh { refreshToken }
  → API: rotateSession (reuse detection!) + signAccessToken
  → new pair stored + auth:session-updated
  → original request retried once with the new access token
```

Logout (`AuthContext.logout`): `POST auth/logout` (server revokes via `revokeSession` on `authSessionId`), then clear the three localStorage keys and null the state. Server-side revocation is what kills the refresh token; clearing storage is cosmetic.

## 5.7 Trace headers

The trace middleware in `physiocoach-ai-api/src/app.ts` honors a client-supplied id:

```ts
req.traceId = req.header('x-request-id') || crypto.randomUUID();
res.setHeader('x-request-id', req.traceId);
```

The id then appears in:

- every RFC 7807 error body as `traceId` (`src/middleware/error.ts`),
- error envelope fallbacks via `withRequestId` (`src/shared/errors/api.ts`: `x-request-id`, then the W3C `traceparent` segment),
- AI audit rows (`logAiAuditEntry`, `traceId` column),
- log lines (`request.failed`, `openrouter.generate_structured.*`).

Support workflow: reproduce an error → read `traceId` from the error detail → grep Worker logs for that id. `AdminPage.tsx` renders `log.traceId` from the admin API, so the web UI can surface the same correlation id.

## 5.8 The workout plan flow, end to end

Full path from button press to rendered plan — the capstone trace:

```
PlanPage ── generateNewPlan()
  │ GET assessments/latest → GET profile          (both may be null; defaults apply)
  │ POST workout-plans/generate { profile, assessment }
  ▼
API pipeline (Module 2) → authMiddleware → workoutPlansRouter
  │  resolve assessment/profile (body → DB → defaults)
  │  buildPlanInputHash
  │  createWorkoutPlanProvider(env)
  │  generateWorkoutPlanWithSafety:
  │     prompt-builder → OpenRouter/Google (timeout 15 s, retries 0)
  │     → parse (fence/trailing-comma repair) → hydrate from catalog
  │     → plan-validator (amber ≤1/day, red rejected)
  │  buildWorkoutPlanRecord → persist assessment + plan (status 'active')
  ▼
200 { data: { id, source: 'ai'|'fallback'|'repaired', model, plan: { days[…] }, inputHash, cached } }
  ▼
PlanPage: setPlanView(payload) → day tabs → SessionPage loads day 1
SessionPage: GET workout-plans/current → maps exercises → logs sets
  → POST workout-sessions → PATCH exercise-logs → POST …/complete
RestTimerHUD: per-set rest countdown (usePreferences: auto-start, sound)
```

Failure branches worth knowing by heart:

| Failure | Client sees | Source |
| --- | --- | --- |
| LLM timeout / provider down | 409 `workout_plan_generation_failed` + `traceId` | `src/routes/workout-plans.ts` |
| Plan fails safety validation | 409 with `reason` + `issues` | `generateWorkoutPlanWithSafety` |
| No DB in environment | 503-style `auth_persistence_unavailable` / `data: null` | `routes/context.ts` |
| Access token expired mid-flow | one silent refresh, then the retried request | `api-client.ts` |

## 5.9 Integration rules of thumb

- New endpoints: mount the router in `src/app.ts` under `/api/v1`; if it needs auth, nothing to do — anything not in `isPublicPath` is protected.
- New client calls: go through `apiClient`; pass `{ token: null }` only for auth endpoints.
- Error contract: throw or return `createApiError` server-side; catch `ApiError` client-side; `problem.detail` is user-facing text.
- Never store or send the refresh token in headers; it travels only in the `/auth/refresh` body.

### Module 5 quick reference

| Concept | File | Key fact |
| --- | --- | --- |
| Base URL | `src/services/api-client.ts` | `VITE_API_URL` → `/api/v1` → prod origin |
| Dev proxy | `physiocoach-ai-web/vite.config.ts` | `/api` → `localhost:8787`, no CORS in dev |
| Refresh mutex | `src/services/api-client.ts` | one shared `refreshPromise` |
| GET dedup | `src/services/api-client.ts` | `inFlightGets` map keyed `token:path` |
| Event bridge | `api-client.ts` ↔ `AuthContext.tsx` | `auth:session-updated` / `auth:session-expired` |
| Trace id | `src/app.ts` + `src/middleware/error.ts` | `x-request-id` honored, echoed, logged |
| Token TTL | `src/auth/keys.ts` | 900 s access / 30 d idle / 60 d absolute |

---

# Module 6 — Hands-On Challenges

Rules for all three challenges: predict what will happen before you run anything; observe with real evidence (network tab, logs, tests); explain the failure or result in one sentence; then revert or keep. `npm run validate` (API) and `npm run build` (web) must pass at the end.

## Challenge 1 — API: sessions endpoint through the full pipeline

Build `GET /api/v1/auth/me/sessions`: list the caller's active sessions.

Files to touch:

1. `physiocoach-ai-api/src/routes/auth.ts` — add the route inside `createAuthRoutes()`:

```ts
route.get('/auth/me/sessions', async (c) => {
  const sessionId = (c as unknown as { get?: (key: string) => unknown }).get?.('authSessionId');
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return unauthorized(c, 'Missing authenticated session.');
  }
  const db = getAuthDb(c.env);
  if (!db) {
    return createApiError(c, 'auth_persistence_unavailable', 'Auth persistence is unavailable in this environment.');
  }
  const user = (c as unknown as { get?: (key: string) => unknown }).get?.('authUser');
  const rows = await db
    .select({ id: authSessions.id, userAgent: authSessions.userAgent, createdAt: authSessions.createdAt })
    .from(authSessions)
    .where(and(eq(authSessions.userId, user!.id), isNull(authSessions.revokedAt)));
  return c.json({ data: rows });
});
```

2. Extend the imports at the top of `auth.ts`: `and, isNull` join `eq` from `drizzle-orm`, and `authSessions` joins `authCredentials, users` from `../db/schema`. Confirm nothing else needs changing, and be able to say why: `authMiddleware` already protects non-public paths; the adapter gives you `c.get('db')`; `unauthorized` and `createApiError` are already imported.

Acceptance:

- [ ] Call with a valid access token → 200 with `data` array.
- [ ] Call without a token → 401 problem+json whose `traceId` matches the `x-request-id` response header.
- [ ] `npm test` passes (`src/app.spec.ts` still green).

Break-it step (do it once, then revert): move `app.use(authMiddleware)` below the router mounts in `src/app.ts`. Predict what `/auth/me/sessions` returns now, run it, and explain the result. (The route throws on missing `authUser`; `resolveRequestUser` in `routes/context.ts` turns that into 401 for non-local envs — and silently falls back to the fixed local user otherwise.)

## Challenge 2 — Web: extract `useRestTimer` from RestTimerHUD

`RestTimerHUD` owns timer state inline (Module 4.7). Extract it into `physiocoach-ai-web/src/hooks/useRestTimer.ts` with the same behavior, then rewire the component.

Suggested shape:

```ts
export interface RestTimerState {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
  start(): void;
  pause(): void;
  addTime(delta: number): void;
  skip(): void;
}

export function useRestTimer(initialSeconds: number, autoStart: boolean, onFinished?: () => void): RestTimerState
```

Requirements:

- Keep the updater form and the `finishedFiredRef` once-flag semantics exactly.
- Keep the interval cleanup; verify under `<StrictMode>` that only one interval ticks (open devtools console, watch a 10-second timer count 10 steps, not 20).
- `RestTimerHUD` keeps all JSX; it only consumes the hook. No visual change.

Break-it steps (revert after each):

1. Delete `return () => clearInterval(timer);`. Predict, run, observe under StrictMode. Explain what double-mounting does to two intervals.
2. Delete the `finishedFiredRef` guard. Explain why the chime and `onFinished` can now fire twice.

Acceptance:

- [ ] `npm run build` passes in `physiocoach-ai-web/`.
- [ ] Timer in a session still auto-starts (check `autoStartRestTimer` in `SettingsPage`), chimes once at zero, skip works.

## Challenge 3 — Integration: prove the silent-refresh mutex

Goal: watch the 401 → single refresh → retry chain happen for real, and prove only one `/auth/refresh` fires.

Setup: in `physiocoach-ai-api/env.dev.vars` set `AUTH_ACCESS_TTL_SEC=60` (schema minimum) and restart `npm run dev` in the API. Sign in at `localhost:5173`, open the network tab, then:

1. Make a request burst: Dashboard + Plan page in quick succession, or paste `apiClient.get('workout-plans/current')` and `apiClient.get('auth/me')` into the console.
2. Wait past 60 s. Trigger the same requests again.
3. Inspect: exactly one `POST /auth/refresh`, then the retried requests return 200.

Then prove the negative — remove `refreshPromise` coordination (make `requestSilentRefresh` always call `performSilentRefresh()` directly), reproduce the burst, and watch the second refresh fail (`token_invalid`) and the session revoke itself via reuse detection. Revert.

Explain in writing, one sentence each:

- Why the second parallel refresh would have revoked the session (name the table and the defense).
- Why `auth/login` is in `SESSION_PATHS` (what would loop forever otherwise).
- Why the retry happens at most once.

Acceptance:

- [ ] Screenshots or notes: one refresh call under the mutex; session revoked without it.
- [ ] `AUTH_ACCESS_TTL_SEC` restored to 900.

## Graduation checklist

Every item must be true from memory. The capstone is item 1.

- [ ] Narrate the full sign-in round trip: AuthPage → api-client → Vite proxy → Worker bridge → pipeline order → login route (rate limit, dummy hash, session, JWT) → token envelope → storeSession → guard redirect. Include the failure branch for wrong password and the 429 branch.
- [ ] Narrate the full plan-generation round trip, including input hash, provider selection, JSON repair, catalog hydration, safety validation, persistence, and the 409 path.
- [ ] Write the pipeline order of `createApp()` from memory and say what breaks if `errorHandler` is not last.
- [ ] State the error-funnel status precedence (Zod / AuthError / `.status` / 500) and the media type it emits.
- [ ] Explain `sid`: why an HS256 JWT needs a database row, and what exactly happens on `auth/logout`.
- [ ] Explain refresh rotation: what is stored, what the client holds, and all three reuse-detection defenses.
- [ ] Explain why `c.get('db')` is lazy and what `max: 5`, `prepare: false` buy.
- [ ] Draw the provider stack in `main.tsx` and explain why `AuthProvider` listens to window events instead of api-client importing it.
- [ ] Write `ProtectedRoute`/`PublicRoute` from memory and explain the `isRestoring` gate.
- [ ] Reproduce the `useRestTimer` effect contract: updater form, cleanup, once-flag — and what StrictMode doubles when each is missing.
- [ ] Trace one `traceId` from browser error detail to server log line and name every hop.
- [ ] Reduce the access TTL and observe the mutex (Challenge 3), then explain it to someone else without notes.

## Appendix A — Command cheat sheet

| Action | Where | Command |
| --- | --- | --- |
| API dev server | `physiocoach-ai-api/` | `npm run dev` |
| API tests | `physiocoach-ai-api/` | `npm test` |
| API full gate | `physiocoach-ai-api/` | `npm run validate` |
| Web dev server | `physiocoach-ai-web/` | `npm run dev` |
| Web type+build check | `physiocoach-ai-web/` | `npm run build` |
| Drizzle migration generate | `physiocoach-ai-api/` | `npm run db:generate` |

## Appendix B — Error contract reference

Server problem+json (from `src/middleware/error.ts`) and client mirror (`ProblemDetails` in `src/services/api-client.ts`):

| Field | Server value | Client use |
| --- | --- | --- |
| `type` | `https://physiocoach.otconnect.ir/problems/<status>` | ignored |
| `title` | e.g. `Unauthorized` | fallback message |
| `detail` | error message (user-facing) | `ApiError.message` |
| `status` | resolved status | branch on number |
| `instance` | `req.originalUrl` | debugging |
| `traceId` | request id | log correlation |
| `errors` | zod issues (400 only) | form errors |

Common codes: `invalid_request` 400 · `unauthorized` 401 · `forbidden` 403 · `not_found` 404 · `email_taken`/`conflict`/`workout_plan_generation_failed` 409 · `rate_limited` 429 · `internal_server_error` 500 · `auth_persistence_unavailable` 503.

---

End of course. When every checklist item holds without notes, you know this stack the way its authors do.
