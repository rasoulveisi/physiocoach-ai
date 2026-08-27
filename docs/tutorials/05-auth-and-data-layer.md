# Part 5 — Auth Engineering & the Data Layer
### PhysioCoach AI Masterclass (Part 5 of 6)

You already know what JWTs, refresh tokens, and sessions *are*. This part shows the concrete
engineering decisions that make them safe in production: how tokens are minted and verified,
why refresh tokens rotate and what reuse detection buys you, how rate limiting is structured,
how the ORM layer is wired, where business logic lives, and how it is all tested. It closes
with the full-stack sign-in trace that ties all six parts together.

---

## 5.1 Token issuing & verification — `src/auth/tokens.ts` (verbatim)

```ts
import { SignJWT, jwtVerify } from 'jose';
import type { AuthKeyConfig } from './keys';

const encoder = new TextEncoder();

export interface AccessTokenClaims {
  sub: string;      // user id
  sid: string;      // session id (ties the access token to a revocable session row)
  email: string;
  roles: string[];
  type: 'access';
  jti: string;      // unique token id
  iat: number; exp: number; iss: string; aud: string;
}

export async function signAccessToken(
  config: AuthKeyConfig,
  user: AuthUserClaims,
  sessionId: string,
): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + config.accessTtlSec;
  const jti = crypto.randomUUID();

  const key = await crypto.subtle.importKey(
    'raw', config.secret as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'] as KeyUsage[],
  );

  const token = await new SignJWT({
    email: user.email, roles: user.roles, type: 'access', sid: sessionId,
  })
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

export async function verifyAccessToken(config: AuthKeyConfig, token: string): Promise<AccessTokenClaims> {
  const key = await crypto.subtle.importKey(
    'raw', config.secret as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'] as KeyUsage[],
  );

  const { payload } = await jwtVerify(token, key, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ['HS256'],
  });

  if (payload.type !== 'access') throw new Error('Not an access token');
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Token missing required claims');
  }

  return payload as unknown as AccessTokenClaims;
}
```

Design decisions to notice:

- **Short-lived access tokens bound to a session.** The `sid` claim links each JWT to a row in
  `auth_sessions`, so revoking a session invalidates the family even while an access token is
  technically unexpired.
- **Pin the algorithm at verification** (`algorithms: ['HS256']`) — never accept whatever
  header claims. Issuer/audience are enforced too, so a token minted for another deployment is
  rejected before claims are read.
- **Explicit claim validation after verify**: signature validity ≠ semantic validity; `type`,
  `sub`, `sid` are checked before anyone trusts the payload.
- **Web Crypto throughout** (`crypto.subtle`, `getRandomValues`) rather than Node-only crypto:
  this code must run identically on Cloudflare Workers, and it costs nothing locally.

Refresh tokens are deliberately *not* JWTs:

```ts
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}
```

An opaque 32-byte random value; **only its SHA-256 hash is stored**. A database leak therefore
does not leak usable refresh tokens. Opaque + hashed beats JWT-for-refresh because revocation
is a simple row operation and nothing needs to be readable inside the token itself.

---

## 5.2 The session table — schema and rotation

From `src/db/schema.ts` (excerpt):

```ts
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    // … expiry / metadata columns …
  },
);
```

Rotation with reuse detection works like this:

1. On login, a session row is created storing the hash of refresh-token #1.
2. Every `/auth/refresh` presents the current token, receives a **new** one, and the row's
   stored hash is updated. Old tokens are dead on arrival.
3. If a token arrives whose hash matches *neither* the current nor a just-retired value — or
   matches a retired value (meaning someone replayed an already-used token) — the session is
   treated as compromised and killed. Replay of a stolen-but-stale token locks the thief out
   and alerts the legitimate client to re-authenticate.

This is why the frontend's single-flight refresh mutex (Part 3) matters so much: concurrent
refreshes would rotate repeatedly, and losing clients would look exactly like attackers.

---

## 5.3 The middleware — request → authenticated context

`src/middleware/auth.ts` (verbatim):

```ts
import type { NextFunction, Request, Response } from 'express';
import { getAuthKeyConfig } from '../auth/keys';
import { verifyAccessToken } from '../auth/tokens';
import type { WorkerBindings } from '../env';
import type { AuthenticatedUser } from '../types/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authSessionId?: string;
      traceId?: string;
      auditLogId?: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const value = req.header('authorization')?.trim();
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (isPublicPath(req.originalUrl)) return next();

  try {
    const bindings = (req.app.locals.workerEnv ?? process.env) as unknown as WorkerBindings;
    if (!bindings.APP_ENV || bindings.APP_ENV === 'local') {
      req.user = {
        id: req.header('x-user-id') || '00000000-0000-4000-8000-000000000001',
        email: req.header('x-user-email') || 'local@physiocoach.dev',
        role: 'user', roles: ['user'],
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
    next(Object.assign(error instanceof Error ? error : new Error('Authentication failed.'), { status: 401 }));
  }
}
```

Mechanics:

- **Type augmentation via declaration merging:** middleware attaches request-scoped values
  (`req.user`, `req.traceId`); the global `Express.Request` interface is augmented once so every
  route gets typed access downstream.
- **Public-path allowlist first**, then verification; any failure funnels into a uniform 401 via
  the decorated-error convention from Part 4.
- **The local-dev bypass** (`APP_ENV === 'local'`): requests without tokens are admitted as a
  fixed dev user. Understand precisely what this is — a development convenience gated on
  environment, never deployed — and why such shortcuts belong in middleware (one place, one
  switch) rather than scattered through routes.

Routes read the result through the adapter's context: `context.get('authUser')` /
`context.get('authSessionId')` (see `routes/express-adapter.ts`, Part 4's §4.5 territory).

---

## 5.4 Rate limiting — `src/auth/rate-limit.ts` (verbatim)

```ts
import { createApiError } from '../shared/errors/api';
import type { ExpressRouteContext } from '../routes/express-adapter';

const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_ATTEMPTS = 5;

type AuthRateLimitBucket = { count: number; resetAt: number };

const authBuckets = new Map<string, AuthRateLimitBucket>();

export function checkAuthRateLimit(c: ExpressRouteContext, routeKey: string): Response | null {
  const now = Date.now();
  const key = `${routeKey}:${getClientKey(c)}`;
  const existing = authBuckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + AUTH_WINDOW_MS };

  bucket.count += 1;
  authBuckets.set(key, bucket);
  pruneExpiredBuckets(now);

  if (bucket.count <= AUTH_MAX_ATTEMPTS) return null;

  c.header('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
  return createApiError(c, 'rate_limited', 'Too many auth attempts. Please retry shortly.');
}

function getClientKey(c: ExpressRouteContext): string {
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';
  const realIp = c.req.header('x-real-ip');
  return realIp?.trim() || 'unknown';
}

function pruneExpiredBuckets(now: number): void {
  if (authBuckets.size < 1_000) return;
  for (const [key, bucket] of authBuckets) {
    if (bucket.resetAt <= now) authBuckets.delete(key);
  }
}
```

A complete fixed-window limiter in ~60 lines: keyed buckets (`route:ip`), lazy bucket creation,
`retry-after` on rejection, memory-bounded by pruning only past a size threshold. Called
explicitly inside sensitive routes (`checkAuthRateLimit(c, 'auth:register')`) rather than
globally — brute-force protection applied where it pays, invisible elsewhere. Note the honest
limits of in-memory state (per-isolate, resets on deploy) and why the client-IP resolution
chain follows the proxy headers actually present in front of this API.

---

## 5.5 Passwords — hashing and enumeration defense

`src/auth/password.ts` implements PBKDF2 via Web Crypto with per-password salts and strength
rules; routes use it like this (from `routes/auth.ts`):

```ts
const DUMMY_PASSWORD_HASH =
  'pbkdf2$50000$AAAAAAAAAAAAAAAAAAAAAA==$2ffAJAWDOjK7twSNwuk4ViIEALV8TIAHNuZwB+zAsDo=';
// …
// Login path (condensed):
const storedHash = credential?.passwordHash ?? DUMMY_PASSWORD_HASH;
const ok = await verifyPassword(password, storedHash);   // always runs a full verify
if (!ok) throw new AuthError('invalid_credentials', 'Invalid email or password.');
```

The dummy-hash idiom: when the email doesn't exist, verify against a constant fake hash anyway
so response timing matches the wrong-password case — user-enumeration via timing analysis dies.
Error messages stay identical for both failure causes ("invalid email or password"), closing
the other enumeration channel.

---

## 5.6 Drizzle ORM — schema-first data access

Schema as typed TypeScript (`src/db/schema.ts`, excerpt):

```ts
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

export const authCredentials = pgTable(
  'auth_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('auth_credentials_user_id_unique').on(table.userId)],
);
```

Connection wiring (`src/db/index.ts`, verbatim):

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { WorkerBindings } from '../env';

export function getDb(bindings: Partial<WorkerBindings> = process.env) {
  const connectionString =
    bindings?.HYPERDRIVE?.connectionString ||
    bindings?.DATABASE_URL ||
    (bindings === process.env ? process.env.DATABASE_URL : undefined);

  if (!connectionString) throw new Error('Database connection is not configured.');

  const client = postgres(connectionString, {
    max: 5, idle_timeout: 10, connect_timeout: 10, prepare: false, fetch_types: false,
  });
  return drizzle(client, { schema });
}
```

The workflow:

- **Edit schema.ts → `npm run db:generate`** produces versioned SQL in `drizzle/migrations/` →
  apply locally/remotely with `db:migrate:*`. Migrations are reviewed artifacts, not surprises.
- **Queries compose relational operators** imported from `drizzle-orm` (`eq`, `and`, `desc`)
  against those typed tables; results arrive fully inferred — no codegen step, no query-string
  building, SQL injection structurally prevented by parameterization.
- Pool sizing is deliberate for serverless adjacency (`max: 5`), `prepare: false` suits pooled/
  proxied Postgres connections. The connection-string precedence chain mirrors the runtime
  matrix (Hyperdrive binding when present, else explicit URL).
- Table design worth copying: separate `auth_credentials` (secrets) from `users` (identity);
  FK cascades so deleting a user cleans up dependents; unique indexes declaring invariants the
  DB enforces, not just the app.

---

## 5.7 Services: isolating nondeterminism behind contracts

The AI workout generator is the flagship service layer under `src/services/workout-generator/`:

- `prompt-builder.ts` composes prompts from the user's assessment/profile context.
- `openrouter-provider.ts` calls the LLM gateway (the only place an API key exists — backend
  only, per workspace policy).
- `plan-validator.ts` + `types/workout-plan-contract.ts` run the raw model output through a
  strict zod contract — exercises referenced must exist in the catalog, sets/reps/structures
  must conform — **before anything touches the database**. No fallback plans are invented when
  validation fails; the request fails loudly with a typed error.

Lesson independent of AI: any nondeterministic producer (LLM, third-party API, webhook) enters
your system through one module, and its output crosses a validated boundary you own. Everything
downstream compiles against the contract, not the chaos.

---

## 5.8 Testing the pipeline — vitest against the real app

`app.ts` exposes the Express instance with a `.fetch()` test harness (Part 4 §4.5), so
integration tests exercise true middleware chains without sockets. `tests/express-app.test.ts`
drives requests end-to-end and asserts status codes plus problem+json shapes; feature suites
(`tests/e2e/workout-plan-generation-workflow.test.ts` etc.) cover multi-step flows. Run with
`npm test`. The pattern: test the assembled app, not internal functions — refactorings then
survive because behavior, not implementation, is pinned.

---

## 5.9 Capstone — the full sign-in trace

Every part of this course appears somewhere in this trace. Narrate it until fluent.

```
CLIENT
AuthPage.submit                       validate → setLoading(true)
  useAuth().login()                   context method                      [P1–P2]
    apiClient.post('auth/login')      fetch wrapper, {token:null}         [P3]
      POST /api/v1/auth/login         vite proxy :5173→:8787              [P0]
SERVER
cors → express.json → traceId → authMiddleware(public-path skip)         [P4]
  alias pass (no match)
  authRouter '/auth/login':
    parseJsonPayload(loginSchema)     zod contract                        [P4]
    checkAuthRateLimit                5/min per IP                        [P5]
    getUserByEmail + DUMMY_HASH       timing-safe credential check        [P5]
    rotateSession/createSession       hashed opaque refresh token         [P5]
    signAccessToken                   jose HS256, sid-bound               [P5]
  ← 200 {accessToken, refreshToken, user}
CLIENT
storeSession                          localStorage ×3 + setState ×2       [P2]
  isAuthenticated flips               provider re-render                  [P2]
  navigate('/dashboard')              ProtectedRoute passes               [P3]

…later… some GET 401 → single-flight refresh (one network call)          [P3]
  → retry OK → 'auth:session-updated' → AuthContext syncs               [P2/P3]
  …or refresh fails → storage cleared → 'auth:session-expired'
    → guard redirects to /auth                                          [P3]
```

Exit criterion: reproduce this trace on paper — both happy path and failure branch, naming the
file responsible at every hop. Then build something with what you've learned (exercises below).

---

## 5.10 Exercises

1. **Rotate it by hand.** In dev, call login twice and inspect successive refresh tokens +
   session rows (or logs). Then replay the *old* refresh token once and observe reuse detection
   kill the session. Explain which line of the flow you just triggered.
2. **Enumeration probe.** Time failed logins for an existing vs nonexistent email (average over
   ~10 runs). Explain your measurement against the dummy-hash defense; try disabling it
   temporarily and re-measure.
3. **Limiter under load.** Fire six rapid register attempts; observe the 429 + `retry-after`.
   Then explain two ways this limiter lies in production (multi-instance memory, IP spoofing
   behind proxies) and name the production-grade remedy for each.
4. **Schema evolution.** Add a nullable `lastLoginAt` column to `users`; generate + apply a
   local migration; set it during login; write one integration assertion using the `.fetch()`
   harness modeled on `tests/express-app.test.ts`.
5. **Contract hardening.** Add a zod refinement to `registerSchema` mirroring the server's
   letter+number password rule; confirm weak passwords now fail at parse time with fielded
   issues instead of deeper in the handler.
6. **Full-stack slice.** Add one profile field end-to-end: column → migration → route → zod →
   settings form → save → reload persists. This single exercise rehearses every part of the
   course.
