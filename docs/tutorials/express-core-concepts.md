# Express Tutorial — All Core Concepts
*Examples from PhysioCoach AI (`physiocoach-ai-api`). Short sections, simple language.*

---

## 1. What Express is

A minimal framework for handling HTTP requests. You write functions that receive a request and send a response.

```ts
import express from 'express';
const app = express();
app.get('/hello', (req, res) => res.json({ hi: true }));
app.listen(8787);
```
*(PhysioCoach assembles the app in `src/app.ts` and starts it in `src/index.ts`.)*

## 2. Middleware

A middleware is any function `(req, res, next)`. It can change the request, end it, or pass it on with `next()`.

```ts
app.use((req, res, next) => {
  req.traceId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.traceId);
  next(); // continue to the next middleware
});
```
*(`src/app.ts` — adds a trace ID to every request)*

**Order matters.** Middleware run in the order they are registered.

## 3. The middleware chain

The whole app is one ordered list:

```ts
app.use(cors());            // 1. allow cross-origin calls
app.use(express.json());    // 2. parse JSON bodies into req.body
app.use(traceId);           // 3. stamp trace id (above)
app.use(authMiddleware);    // 4. verify token → req.user
// 5. path aliases (rewrite req.url)
app.use('/api/v1', healthRouter);        // 6–13. resource routers
app.use(errorHandler);      // 14. catch errors last
```

If you put `express.json()` after routes, bodies arrive undefined.
If you put `errorHandler` first, it never catches anything.

## 4. Routing

Routes map method + path to a handler:

```ts
healthRouter.get('/health', handler);      // GET /api/v1/health
authRouter.post('/auth/login', handler);   // POST /api/v1/auth/login
```

Mount a router under a prefix; the prefix is stripped inside it:

```ts
app.use('/api/v1', authRouter);            // '/auth/login' here = '/api/v1/auth/login' outside
```

Path params and query params:

```ts
router.delete('/notes/:id', (req, res) => { /* req.params.id */ });
const page = req.query.page;               // ?page=2
```

## 5. Request and response

Everything you need lives on two objects:

```ts
req.header('authorization')   // request headers
req.body                      // parsed JSON body (needs express.json())
req.params / req.query        // URL values

res.status(200).json({ ok: true });          // send JSON
res.setHeader('retry-after', '30');          // response headers
res.redirect(302, '/somewhere');             // redirect
```

## 6. Serving JSON

Return data with status codes:

```ts
res.status(200).json({
  ok: true,
  database: { ok: true, responseTimeMs: Math.round(performance.now() - startedAt) },
});
```
*(`src/routes/health.ts`)*

## 7. Async handlers and errors

Handlers can be async. Wrap risky work in try/catch and forward failures with `next(error)`:

```ts
healthRouter.get('/health', async (req, res, next) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true });
  } catch (error) {
    next(Object.assign(new Error('Database check failed.'), { status: 503 }));
  }
});
```
*(`src/routes/health.ts`)*

Attaching `status` to the error tells the central handler what HTTP code to use.
Express 5 also auto-forwards rejected async handlers, but explicit `next(error)` keeps codes intentional.

## 8. Body parsing

`express.json()` turns the incoming body into `req.body`. Without it, `req.body` is undefined.

```ts
app.use(express.json());
```

## 9. Validation with zod

Define the expected shape, then parse. Never trust input.

```ts
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const parsed = schema.safeParse(payload);
if (!parsed.success) return invalidRequest(c, 'Validation failed.', {
  issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
});
// parsed.data is now fully typed
```
*(`src/routes/auth.ts`, `src/routes/validation.ts`)*

After parsing, TypeScript knows the exact types — no extra checks needed downstream.

## 10. Routers (splitting an app)

One router per resource keeps files small:

```ts
export const healthRouter = Router();
healthRouter.get(...);

// app.ts
app.use('/api/v1', healthRouter);
app.use('/api/v1', authRouter);
// … profiles, assessments, workout-plans, workout-sessions, exercise-catalog, admin
```
*(`src/app.ts`)*

## 11. Thin controllers

Route files should only: validate input → call service/DB code → respond. Logic lives in `services/` and `auth/`.

```ts
route.post('/workout-plans/generate', async (c) => {
  const parsed = await parseJsonPayload(c, schema);   // 1. validate
  const plan = await workoutGenerator.generate(parsed.data); // 2. delegate
  return c.json(plan);                                // 3. respond
});
```
*(pattern used across `src/routes/`)*

## 12. Centralized error handling

An error middleware has **four** parameters and sits last. One place formats every error:

```ts
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const status =
    error instanceof ZodError ? 400 :
    isAuthError(error) ? error.statusCode :
    typeof error.status === 'number' ? error.status : 500;

  res.status(status).type('application/problem+json').json({
    title: statusTitles[status] || 'Request Failed',
    detail: error.message,
    instance: req.originalUrl,
    traceId,
  });
};
```
*(`src/middleware/error.ts` — condensed)*

Every endpoint returns errors in the same shape. Clients parse one format (`ProblemDetails`).

## 13. CORS

Allows browsers on other domains to call your API:

```ts
app.use(cors());
```
*(`src/app.ts`)*

Handles preflight OPTIONS requests and adds `Access-Control-*` headers.

## 14. Auth middleware pattern

Verify once in the chain, attach the result, all routes benefit:

```ts
export async function authMiddleware(req, _res, next) {
  if (isPublicPath(req.originalUrl)) return next();   // skip public endpoints

  try {
    const claims = await verifyAccessToken(config, bearerToken(req));
    req.user = { id: claims.sub, email: claims.email, roles: claims.roles };
    next();
  } catch (error) {
    next(Object.assign(new Error('Authentication failed.'), { status: 401 }));
  }
}
```
*(`src/middleware/auth.ts` — condensed)*

TypeScript tip — give `req.user` a type globally:

```ts
declare global {
  namespace Express {
    interface Request { user?: AuthenticatedUser; traceId?: string; }
  }
}
```

## 15. JWTs (jose)

Sign short-lived access tokens; verify with pinned options:

```ts
const token = await new SignJWT({ email, roles, sid })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setIssuer(config.issuer)
  .setAudience(config.audience)
  .setExpirationTime(exp)
  .sign(key);

const { payload } = await jwtVerify(token, key, {
  issuer: config.issuer, audience: config.audience, algorithms: ['HS256'],
});
```
*(`src/auth/tokens.ts` — condensed)*

Always pin `algorithms`, issuer, audience at verification.

## 16. Refresh sessions (rotation)

Access token = short life. Refresh token = opaque random string; store only its SHA-256 hash. Each refresh issues a new token and updates the stored hash; reusing an old one kills the session (reuse detection).

```ts
export function generateRefreshToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}
export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}
```
*(`src/auth/tokens.ts`)*

## 17. Password hashing

Hash passwords with a salt (PBKDF2 here), verify by re-deriving:

```ts
const ok = await verifyPassword(password, storedHash);
if (!ok) throw new AuthError('invalid_credentials', 'Invalid email or password.');
```
*(`src/auth/password.ts`, `src/routes/auth.ts`)*

Enumeration defense — when the user doesn't exist, verify against a dummy hash anyway so both cases take equal time and return the same message.

## 18. Rate limiting

Count attempts per key in a time window; reject beyond the limit:

```ts
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_ATTEMPTS = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

bucket.count += 1;
if (bucket.count > AUTH_MAX_ATTEMPTS) {
  c.header('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
  return createApiError(c, 'rate_limited', 'Too many attempts.');
}
return null; // allowed
```
*(`src/auth/rate-limit.ts` — condensed)*

Applied per sensitive route (login, register), not globally.

## 19. Database with Drizzle ORM

Tables are typed objects; queries are function calls:

```ts
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
}, (t) => [uniqueIndex('users_email_unique').on(t.email)]);

// query
await db.select().from(users).where(eq(users.email, email)).limit(1);
```
*(`src/db/schema.ts`, routes)*

Workflow:
1. Edit `schema.ts`.
2. `npm run db:generate` → migration SQL appears in `drizzle/`.
3. Review it, then `npm run db:migrate:local` (or `:remote`).

Relations use references with cascade rules so deletes clean up automatically.

## 20. Connecting to Postgres

One place creates the client from env config:

```ts
export function getDb(bindings = process.env) {
  const connectionString =
    bindings?.HYPERDRIVE?.connectionString || bindings?.DATABASE_URL;
  if (!connectionString) throw new Error('Database connection is not configured.');
  const client = postgres(connectionString, { max: 5, idle_timeout: 10 });
  return drizzle(client, { schema });
}
```
*(`src/db/index.ts`)*

Secrets come from environment variables — never hard-coded.

## 21. Service layer

Business logic lives outside route files. Nondeterministic inputs (like AI output) pass through a strict validation contract before touching the DB:

```
prompt-builder → openrouter-provider → plan-validator (zod) → save
```
*(`src/services/workout-generator/`)*

If validation fails, the request fails loudly — no silent fallbacks.

## 22. Environment variables

Read config through one typed module:

```ts
// src/env.ts defines WorkerBindings; values come from .env / platform secrets
const secret = getAuthKeyConfig(bindings).secret;   // never in code, never committed
```

Keep `.env*` out of git. Provide `.env.example` files instead (this repo does).

## 23. Testing the API

Test the assembled app end-to-end, not internal functions:

```ts
const res = await app.fetch(new Request('http://localhost/api/v1/health'));
expect(res.status).toBe(200);
```
*(`tests/express-app.test.ts` — via the `.fetch()` harness in `src/app.ts`)*

Run with `npm test`.

## 24. Project structure

```
src/
  index.ts        # entry: create + start the server
  app.ts          # middleware chain + router mounting
  middleware/     # auth, error funnel
  routes/         # thin controllers per resource
  services/       # business logic
  auth/           # tokens, sessions, passwords, rate limit
  db/             # schema, client, migrations
tests/            # integration tests
```

---

## Quick reference

| Need | Tool |
|---|---|
| Handle a request | `app.get/post(path, handler)` |
| Group routes | `Router()` + `app.use(prefix, router)` |
| Parse JSON body | `express.json()` |
| Validate input | zod `safeParse` |
| Shared logic per request | middleware |
| Uniform errors | 4-arg error middleware last |
| Auth | verify JWT in middleware → `req.user` |
| DB | Drizzle: edit schema → generate → migrate |
| Secrets | env vars only |
