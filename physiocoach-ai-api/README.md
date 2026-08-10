# PhysioCoach AI API

Cloudflare Workers API for PhysioCoach AI. The service exposes health, profile, assessment, workout plan, workout session, progress, and OpenAPI routes backed by Cloudflare D1.

## Local Setup

Install dependencies:

```sh
pnpm install
```

Copy local environment defaults and fill in provider credentials:

```sh
cp .env.dev .dev.vars
```

Generate and apply local D1 migrations:

```sh
pnpm db:generate
pnpm db:migrate:local
```

Start the local Worker:

```sh
pnpm dev
```

## Validation

Run local validation (works without GitHub CI):

```sh
pnpm validate
```

Post-deploy smoke checks:

```sh
AUTH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api
AUTH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api:dev
AUTH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api:prod
```

Supported bearer token env vars: `AUTH_ACCESS_TOKEN`, `PHYSIOCOACH_ACCESS_TOKEN`,
or `API_SMOKE_TOKEN`. The token must be a first-party API access JWT issued by
this backend; the smoke script does not perform login.

Without a token, the script verifies public endpoints only:

- `GET /health`
- `OPTIONS /workout-plans/current` (CORS preflight)

With a token, set `API_SMOKE_ACTIVE_CATALOG_ID` for the active dev catalog. The
authenticated smoke then checks its ready coverage, the required active safety
considerations, and the existing plan/session path. Catalog validators also
cover the severe-knee invariant: a red/avoid exercise is never accepted.
See [exercise catalog operations](docs/exercise-catalog-operations.md) for the
local snapshot, import, analysis, dev activation, and rollback procedure.
The state machine is forward-only: duplicate decisions are persisted, manual
review changes atomically increment a revision, and rollback activates a fresh
reviewed snapshot rather than reopening a retired catalog.

## Local Release Check

```sh
pnpm validate
pnpm dev
curl http://localhost:8787/api/v1/health
```

Quick checks:

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm build
curl http://localhost:8787/api/v1/health
```

Expected health response:

```json
{ "ok": true, "service": "physiocoach-ai-api", "version": "0.1.0" }
```

## Local Auth Behavior

Public routes (`/api/v1/health`, `/api/v1/openapi.json`, and `/api/v1/docs`) do not
require auth. Protected routes in `APP_ENV=dev` require a first-party API bearer token even
when called through localhost; loopback host alone is not an auth bypass.

JWT validation is configured with:

- `AUTH_JWT_SECRET`
- `AUTH_ISSUER`
- `AUTH_AUDIENCE`
- `AUTH_ACCESS_TTL_SEC`
- `AUTH_REFRESH_IDLE_DAYS`
- `AUTH_REFRESH_ABSOLUTE_DAYS`

Google OAuth login is optional and uses `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` when enabled.

For Swagger UI development in deployed dev, use a real bearer token through the
Swagger authorize control. Public docs never embed `LOCAL_AUTH_BYPASS_TOKEN` or
send `x-local-auth-bypass` automatically. `APP_ENV=local` remains fully bypassed
for local-only development, and local docs may send `x-dev-swagger: 1`.

Register, login, and refresh are protected by a small in-memory per-isolate rate
limit keyed by route and client IP-ish headers. This is best-effort only because
Workers isolates do not share memory; keep Cloudflare WAF/Rate Limiting enabled
for production auth endpoints.

## Deployment

The API deploys to Cloudflare Workers + D1:

- Worker: `physiocoach-ai-api-dev`
- Public API base URL (dev): `https://physiocoach-ai-api-dev.otconnect.ir/api/v1`
- Frontend origins allowed by CORS:
  - Dev: `https://dev.physiocoach-ai-web.pages.dev`
  - Prod: `https://physiocoach.otconnect.ir`

The custom API domain is intentional. The `workers.dev` URL can be protected by
Cloudflare Access and may return `302` redirects or `1101` errors before a request
reaches the Worker. The custom domain is the stable URL wired into Cloudflare Pages.

Manual deploy:

```sh
pnpm db:migrate:dev
pnpm deploy:dev
```

For production:

```sh
pnpm db:migrate:prod
pnpm deploy:prod
```

## Workout plan runtime behavior

Current behavior for workout plan endpoints:

- Every `POST /api/v1/workout-plans/generate` call always runs an AI generation pass.
- No backend cache reuse is used for generation, so each request produces a fresh generation path.
- The generation model chain is configured in `wrangler.toml` as primary `google/gemma-4-26b-a4b-it:free` and fallback `openrouter/owl-alpha`.
- Gemini is not in the configured model chain by default.
- If the AI output fails schema or safety checks, the API returns the deterministic fallback plan with warnings.
  See [docs/deployment.md](docs/deployment.md) for Cloudflare setup, secrets, and manual deployment commands.

## Husky Pre-Push Hook

Run `pnpm install` once to install Husky hooks. On every `git push`, the API
repo runs:

```sh
pnpm run sync:envs
```

It updates `.dev.vars` and `.prod.vars` from the example env files and blocks push
if those files changed.
