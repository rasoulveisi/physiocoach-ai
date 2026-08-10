# Architecture Blueprint: Angular + Netlify + Clerk + Cloudflare Workers + OpenRouter (Free-Model path)

Use this as a reusable template for creating a new application with:

- Angular SPA on Netlify
- Clerk authentication in browser + JWT validation in API
- API on Cloudflare Workers (Hono)
- Persistence in Cloudflare D1
- AI calls through OpenRouter free models from Worker only

All names below are examples (replace with your project values).

---

## 1) Separation of concerns

- `web/` (Angular app)
  - Handles UI, routing, forms, and Clerk sign-in.
  - Never calls OpenRouter directly.
  - Sends `Authorization: Bearer <clerk_jwt>` to backend API.
- `api/` (Cloudflare Worker)
  - Exposes `/api/v1/*`.
  - Validates Clerk tokens.
  - Stores application data in D1.
  - Calls OpenRouter only from server side.

---

## 2) Wiring path for one request

1. Browser loads `web` from Netlify.
2. App reads runtime settings from `public/config.js`.
3. User authenticates via Clerk in browser.
4. Every protected API call sends Clerk token.
5. Worker middleware validates JWT and sets user context.
6. Route handler validates payload and builds AI context.
7. Worker calls OpenRouter with:
   - primary model
   - fallback model list
   - timeout/retry policy
8. Response is validated and persisted to D1.
9. Client renders result.

---

## 3) Frontend wiring

### 3.1 Runtime config contract (web)

The frontend should use a tiny runtime object loaded from `public/config.js`:

```ts
// /app/core/config/app-config.ts
export interface AppConfig {
  apiUrl: string;
  clerkPublishableKey: string;
  environment: 'local' | 'development' | 'staging' | 'production';
}
```

Resolution strategy:

- If hosted on production Netlify host -> production API URL.
- If hosted on dev Netlify host -> dev API URL.
- Otherwise use local default and/or values from `config.js`.

### 3.2 Netlify app config script

Keep a build-time script to generate `public/config.js`.

Inputs to resolve:

- `NG_APP_ENV`
- `NG_APP_API_BASE_URL`
- `NG_APP_CLERK_PUBLISHABLE_KEY`
- optional Netlify aliases:
  - `NETLIFY_API_BASE_URL_DEV`
  - `NETLIFY_API_BASE_URL_PROD`
  - `NETLIFY_CLERK_PUBLISHABLE_KEY_DEV`
  - `NETLIFY_CLERK_PUBLISHABLE_KEY_PROD`

Script behavior:

- Reads env from `.env*` for local/non-Netlify builds.
- On Netlify, prefers platform-provided vars.
- Writes:

```js
window.__APP_CONFIG__ = {
  apiUrl: 'https://api.example.dev/api/v1',
  clerkPublishableKey: 'pk_test_...',
  environment: 'development',
};
```

### 3.3 Frontend env files

Use these templates in `web/`:

```bash
# web/.env.dev
NG_APP_ENV=development
NG_APP_API_BASE_URL=https://api-dev.example.com/api/v1
NG_APP_CLERK_PUBLISHABLE_KEY=pk_test_...
```

```bash
# web/.env.production
NG_APP_ENV=production
NG_APP_API_BASE_URL=https://api.example.com/api/v1
NG_APP_CLERK_PUBLISHABLE_KEY=pk_live_...
```

```bash
# web/.env.example
NG_APP_ENV=development
NG_APP_API_BASE_URL=https://api-dev.example.com/api/v1
NG_APP_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3.4 Netlify site wiring (`netlify.toml`)

```toml
[build]
  command = "pnpm build"
  publish = "dist/example-web/browser"

[build.environment]
  NG_APP_ENV = "development"
  NG_APP_API_BASE_URL = "https://api-dev.example.com/api/v1"
  NG_APP_CLERK_PUBLISHABLE_KEY = "pk_test_replace"

[context.production.environment]
  NG_APP_ENV = "production"
  NG_APP_API_BASE_URL = "https://api.example.com/api/v1"
  NG_APP_CLERK_PUBLISHABLE_KEY = "pk_live_replace"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
    [headers.values]
      X-Frame-Options = "DENY"
      X-Content-Type-Options = "nosniff"
      Referrer-Policy = "strict-origin-when-cross-origin"
```

Notes:

- Keep `publish` path matching your Angular output.
- Keep security headers on all responses.
- Use separate dev/prod Netlify sites or branch-context separation.

### 3.5 API client behavior (frontend)

- Create typed API client that prepends `apiUrl`.
- Add `Authorization` header from local token store.
- Keep token store browser-safe and nullable.

---

## 4) Backend wiring (Cloudflare Worker)

### 4.1 Worker entry + middleware

- `index.ts`: top-level fetch wrapper with CORS + `health` fast path.
- `app.ts`: global middleware with:
  - request id
  - CORS gate for `/api/*`
  - Clerk auth middleware
  - route mounting for `/api/v1`

### 4.2 Clerk auth middleware wiring

- Validate Bearer token from `Authorization` header.
- In local mode, allow a local test user.
- In non-local mode:
  - decode token header to get issuer
  - fetch JWKS
  - verify signature/claims
  - map roles/email/userId into internal context

Public endpoints should be exempt:

- `/api/v1/openapi.json`
- `/api/v1/health`
- `/api/v1/docs`
- `/health`

### 4.3 Env validation

Parse env with schema in Worker runtime at startup/route boundaries.
Required logical fields:

- `APP_ENV`
- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_REFERER`
- `OPENROUTER_TITLE`
- `WORKOUT_MODEL_PRIMARY`
- `WORKOUT_MODEL_FALLBACKS`
- `OPENROUTER_TIMEOUT_MS`
- `OPENROUTER_MAX_RETRIES`
- `CORS_ORIGIN`

### 4.4 AI provider wiring

- Create provider factory `createWorkoutPlanProvider(env)`.
- Read API key and model settings from env.
- If key missing or placeholder => fallback provider that throws explicit config error.
- Use OpenRouter HTTP endpoint `/chat/completions` with:
  - model list (primary + fallbacks)
  - timeout and retry per env
  - structured output schema (strict JSON)

### 4.5 OpenRouter model chain config

Use free-first primary and fallbacks in env:

- `google/gemma-4-26b-a4b-it:free`
- `openrouter/owl-alpha`

Keep whitelist in code so only expected IDs can be used.

### 4.6 Route wiring pattern

Group all API v1 routes under:

- `createV1Routes()` -> individual route modules.

AI generation endpoint example:

- `POST /api/v1/workout-plans/generate`
- input validated by schema
- build model context
- generate using orchestrator
- persist result in D1
- return normalized output

---

## 5) Netlify deployment workflow

1. Create Netlify site for dev and prod.
2. Attach repository and set build command/publish dir from above.
3. Configure environment variables per environment:
   - dev: test Clerk key, dev API base URL
   - prod: live Clerk key, prod API base URL
4. Deploy by branch context or separate site per environment.
5. Verify:
   - `https://<site>/config.js`
   - contains expected `apiUrl` and `clerkPublishableKey`

---

## 6) Cloudflare Workers & D1 wiring

### 6.1 `wrangler.toml` shape

```toml
name = "example-api"
main = "src/index.ts"
compatibility_date = "2025-05-30"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[vars]
APP_ENV = "local"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_REFERER = "http://localhost:4200"
OPENROUTER_TITLE = "Example API Local"
WORKOUT_MODEL_PRIMARY = "google/gemma-4-26b-a4b-it:free"
WORKOUT_MODEL_FALLBACKS = "openrouter/owl-alpha"
OPENROUTER_TIMEOUT_MS = "180000"
OPENROUTER_MAX_RETRIES = "0"
CORS_ORIGIN = "http://localhost:4200,http://localhost:8787"

[observability.logs]
enabled = false
invocation_logs = true

[[d1_databases]]
binding = "DB"
database_name = "example_local"
database_id = "local-d1-id"
migrations_dir = "src/db/migrations"

[env.dev]
name = "example-api-dev"
routes = [{ pattern = "api-dev.example.com", custom_domain = true }]

[env.dev.vars]
APP_ENV = "dev"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_REFERER = "https://dev.example.netlify.app"
OPENROUTER_TITLE = "Example App Dev"
WORKOUT_MODEL_PRIMARY = "google/gemma-4-26b-a4b-it:free"
WORKOUT_MODEL_FALLBACKS = "openrouter/owl-alpha"
OPENROUTER_TIMEOUT_MS = "180000"
OPENROUTER_MAX_RETRIES = "0"
CORS_ORIGIN = "https://dev.example.netlify.app,https://*.example.netlify.app,http://localhost:4200"

[[env.dev.d1_databases]]
binding = "DB"
database_name = "example_dev"
database_id = "<dev-d1-database-id>"
migrations_dir = "src/db/migrations"

[env.production]
name = "example-api"
routes = [{ pattern = "api.example.com", custom_domain = true }]

[env.production.vars]
APP_ENV = "production"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_REFERER = "https://example.netlify.app"
OPENROUTER_TITLE = "Example App"
WORKOUT_MODEL_PRIMARY = "google/gemma-4-26b-a4b-it:free"
WORKOUT_MODEL_FALLBACKS = "openrouter/owl-alpha"
OPENROUTER_TIMEOUT_MS = "180000"
OPENROUTER_MAX_RETRIES = "0"
CORS_ORIGIN = "https://example.netlify.app,https://example.com"

[[env.production.d1_databases]]
binding = "DB"
database_name = "example_prod"
database_id = "<prod-d1-database-id>"
migrations_dir = "src/db/migrations"
```

Important notes:

- Top-level `[vars]` does not fully replace env-specific vars in some deployments.
- Keep every required non-secret field in `[env.dev.vars]` and `[env.production.vars]`.
- Put secrets only with `wrangler secret put`:
  - `CLERK_ISSUER`
  - `CLERK_JWKS_URL`
  - `OPENROUTER_API_KEY`

### 6.2 Secrets in API env files for local tooling

Recommended `.env` templates:

```bash
# api/.env.dev.example
APP_ENV=dev
CLERK_ISSUER=https://dev-clerk.example.com
CLERK_JWKS_URL=https://dev-clerk.example.com/.well-known/jwks.json
OPENROUTER_API_KEY=set-in-cloudflare-secret
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_REFERER=https://dev.example.netlify.app
OPENROUTER_TITLE=Example App Dev
WORKOUT_MODEL_PRIMARY=google/gemma-4-26b-a4b-it:free
WORKOUT_MODEL_FALLBACKS=openrouter/owl-alpha
OPENROUTER_TIMEOUT_MS=180000
OPENROUTER_MAX_RETRIES=0
CORS_ORIGIN=https://dev.example.netlify.app,https://*.example.netlify.app,http://localhost:4200
```

```bash
# api/.env.production.example
APP_ENV=production
CLERK_ISSUER=https://clerk.example.com
CLERK_JWKS_URL=https://clerk.example.com/.well-known/jwks.json
OPENROUTER_API_KEY=set-in-cloudflare-secret
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_REFERER=https://example.netlify.app
OPENROUTER_TITLE=Example App
WORKOUT_MODEL_PRIMARY=google/gemma-4-26b-a4b-it:free
WORKOUT_MODEL_FALLBACKS=openrouter/owl-alpha
OPENROUTER_TIMEOUT_MS=180000
OPENROUTER_MAX_RETRIES=0
CORS_ORIGIN=https://example.netlify.app,https://example.com,https://*.example.com
```

Use Husky/pre-push sync script (or equivalent) to keep `.dev.vars` / `.prod.vars` aligned with examples.

---

## 7) Exact setup and deployment checklist

1. Register Clerk app
   - Create project.
   - Add allowed origins.
   - Capture publishable keys (test/live).
   - Capture issuer + JWKS URL.
2. Build Worker
   - Configure `wrangler.toml` with two environments.
   - Create D1 DBs and update IDs in `wrangler.toml`.
   - Add secrets (`CLERK_ISSUER`, `CLERK_JWKS_URL`, `OPENROUTER_API_KEY`).
3. Build frontend
   - Configure `web/.env.*` and Netlify env vars.
   - Ensure build runs `prebuild` that writes `public/config.js`.
4. Deploy API
   - `pnpm db:migrate:dev` and `pnpm deploy:dev`.
   - `pnpm db:migrate:prod` and `pnpm deploy:prod`.
5. Deploy Netlify sites
   - dev + prod configs as above.
6. Smoke test
   - `curl <api>/api/v1/health`
   - preflight from frontend origin for protected route
   - run login + protected page flow
   - call generate endpoint and verify data persists

---

## 8) What to change when cloning this architecture

Replace all placeholders:

- project/domain names
- API hostnames
- Netlify site identifiers
- Clerk domains and keys
- D1 DB names/IDs
- model IDs if you want custom providers

Everything else can stay structurally the same.
