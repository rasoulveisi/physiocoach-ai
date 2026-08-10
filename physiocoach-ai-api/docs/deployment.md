# Cloudflare Deployment

This API deploys to Cloudflare Workers and uses Cloudflare D1 through the `DB` binding configured in `wrangler.toml`.

Target free-tier dual-environment deployment:

```text
Worker name: physiocoach-ai-api-dev
Public API base URL: https://physiocoach-ai-api-dev.otconnect.ir/api/v1
Frontend origin (dev): https://dev.physiocoach-ai-web.pages.dev
Frontend origin (prod): https://physiocoach.otconnect.ir
Database: physiocoach_dev
AI gateway: OpenRouter
Auth issuer: First-party JWT auth
```

Production:

```text
Worker name: physiocoach-ai-api
Public API base URL: https://physiocoach-ai-api.otconnect.ir/api/v1
Frontend origin (prod): https://physiocoach.otconnect.ir
Database: physiocoach_prod
```

Use the custom domain for the frontend. Do not wire Cloudflare Pages to the `workers.dev`
URL if Cloudflare Access is enabled for that hostname.

## D1 Databases

Create the dev and production D1 databases:

```sh
pnpm wrangler d1 create physiocoach_dev
pnpm wrangler d1 create physiocoach_prod
```

Copy the generated database IDs into `wrangler.toml`:

```toml
[[env.dev.d1_databases]]
binding = "DB"
database_name = "physiocoach_dev"
database_id = "<dev-database-id>"

[[env.production.d1_databases]]
binding = "DB"
database_name = "physiocoach_prod"
database_id = "<production-database-id>"
```

Apply migrations:

```sh
pnpm db:migrate:dev
pnpm db:migrate:prod
```

## Worker Runtime Configuration

Set runtime configuration in each Cloudflare environment. Use `.env.dev.example`
and `.env.production.example` as the checklist.

Sensitive values:

- `AUTH_JWT_SECRET`
- `OPENROUTER_API_KEY`
- `GOOGLE_OAUTH_CLIENT_ID` (optional)
- `GOOGLE_OAUTH_CLIENT_SECRET` (optional)

Non-secret values already live in `wrangler.toml` `[env.*.vars]`:

- `APP_ENV`
- `AUTH_ISSUER`
- `AUTH_AUDIENCE`
- `AUTH_ACCESS_TTL_SEC`
- `AUTH_REFRESH_IDLE_DAYS`
- `AUTH_REFRESH_ABSOLUTE_DAYS`
- `GOOGLE_OAUTH_REDIRECT_URI` (optional)
- `OPENROUTER_BASE_URL`
- `WORKOUT_MODEL_PRIMARY`
- `WORKOUT_MODEL_FALLBACKS`
- `OPENROUTER_TIMEOUT_MS`
- `OPENROUTER_MAX_RETRIES`
- `CORS_ORIGIN`

Do not put non-secret vars with `wrangler secret put` unless you intentionally
want dashboard-hidden values. Wrangler environment vars are not inherited from
top-level `[vars]`, so each `[env.*.vars]` must include its own `CORS_ORIGIN`.

Dev:

```sh
pnpm wrangler secret put AUTH_JWT_SECRET --env dev
pnpm wrangler secret put GOOGLE_OAUTH_CLIENT_ID --env dev
pnpm wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --env dev
pnpm wrangler secret put OPENROUTER_API_KEY --env dev
```

Production:

```sh
pnpm wrangler secret put AUTH_JWT_SECRET --env production
pnpm wrangler secret put GOOGLE_OAUTH_CLIENT_ID --env production
pnpm wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --env production
pnpm wrangler secret put OPENROUTER_API_KEY --env production
```

Skip the `GOOGLE_OAUTH_*` secrets when Google login is not enabled.

## Auth Edge Protection

The Worker includes a small in-memory per-isolate limiter for `/auth/register`,
`/auth/login`, and `/auth/refresh`. Treat it as a defense-in-depth guard only:
configure Cloudflare WAF/Rate Limiting rules for those endpoints in dev and
production because isolate memory is not shared globally.

Swagger UI in deployed dev must use bearer auth. Do not expose
`LOCAL_AUTH_BYPASS_TOKEN` in public docs or inject `x-local-auth-bypass` from
browser-side docs code.

## Auth Values

Use separate JWT secrets for dev and production. Generate strong random values
outside the repo, then store them with `wrangler secret put`.

Recommended environment mapping:

```text
AUTH_JWT_SECRET=<strong-random-secret>
AUTH_ISSUER=physiocoach-ai-api-dev
AUTH_AUDIENCE=physiocoach-ai-web
AUTH_ACCESS_TTL_SEC=900
AUTH_REFRESH_IDLE_DAYS=30
AUTH_REFRESH_ABSOLUTE_DAYS=60
```

Production should use the production issuer:

```text
AUTH_ISSUER=physiocoach-ai-api
```

When Google OAuth login is enabled, configure a Google OAuth web client and add
these redirect URIs:

```text
http://localhost:8787/api/v1/auth/google/callback
https://physiocoach-ai-api-dev.otconnect.ir/api/v1/auth/google/callback
https://physiocoach-ai-api.otconnect.ir/api/v1/auth/google/callback
```

## Real Environment Files (API)

Use explicit env files for local/automated setup:

```bash
# API/.env.dev
APP_ENV=dev
AUTH_JWT_SECRET=set-in-cloudflare-secret
AUTH_ISSUER=physiocoach-ai-api-dev
AUTH_AUDIENCE=physiocoach-ai-web
AUTH_ACCESS_TTL_SEC=900
AUTH_REFRESH_IDLE_DAYS=30
AUTH_REFRESH_ABSOLUTE_DAYS=60
OPENROUTER_API_KEY=set-in-cloudflare-secret

# API/.env.production
APP_ENV=production
AUTH_JWT_SECRET=set-in-cloudflare-secret
AUTH_ISSUER=physiocoach-ai-api
AUTH_AUDIENCE=physiocoach-ai-web
AUTH_ACCESS_TTL_SEC=900
AUTH_REFRESH_IDLE_DAYS=30
AUTH_REFRESH_ABSOLUTE_DAYS=60
OPENROUTER_API_KEY=set-in-cloudflare-secret
```

For Worker environment deployment, keep `.dev.vars` and `.prod.vars` aligned with
their matching `*.example` files. Husky’s `sync:envs` pre-push hook regenerates them
when needed.

## OpenRouter Values

Create an OpenRouter key at:

```text
https://openrouter.ai/settings/keys
```

Set it only as a Cloudflare secret:

```sh
pnpm wrangler secret put OPENROUTER_API_KEY --env dev
```

The current default model config in `wrangler.toml` is:

```toml
WORKOUT_MODEL_PRIMARY = "google/gemma-4-26b-a4b-it:free"
WORKOUT_MODEL_FALLBACKS = "openrouter/owl-alpha"
OPENROUTER_TIMEOUT_MS = "180000"
OPENROUTER_MAX_RETRIES = "0"
```

All AI calls must go through this Worker. Never expose `OPENROUTER_API_KEY` to
Angular or Cloudflare Pages.

## Smoke Tests

Smoke checks always verify public endpoints. Protected checks require an API
access JWT issued by this backend:

```sh
AUTH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api:dev
PHYSIOCOACH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api:prod
```

The smoke script also accepts `API_SMOKE_TOKEN` for CI systems that use a
test-specific variable name.

For catalog rollout, provide `API_SMOKE_ACTIVE_CATALOG_ID` with an admin token.
The authenticated smoke verifies active catalog readiness and complete coverage
plus `knee_pain`, `lower_back_pain`, and `high_impact_intolerance`. Without a
token it retains public health and CORS checks only. Follow
[exercise catalog operations](exercise-catalog-operations.md) for the exact
dev-only import, activation gates, duplicate review, rollback, inferred
severity, and media restrictions. Do not activate production from this runbook.

Catalog lifecycle is strictly
`importing -> analyzing -> review_required -> ready -> active -> retired`. Manual review endpoints use atomic D1 batches and increment
`review_revision`; readiness updates only its exact evaluated revision. Rollback
activates a new reviewed snapshot of the prior source and never reopens `retired`.

## Custom Worker Domain

The dev Worker is exposed through a Cloudflare custom domain:

```toml
[env.dev]
name = "physiocoach-ai-api-dev"
workers_dev = true
routes = [
  { pattern = "physiocoach-ai-api-dev.otconnect.ir", custom_domain = true }
]
```

This creates:

```text
https://physiocoach-ai-api-dev.otconnect.ir/api/v1
```

Use this value in Cloudflare Pages:

```text
NG_APP_API_BASE_URL=https://physiocoach-ai-api-dev.otconnect.ir/api/v1
```

If you create a production custom domain later, use the same pattern, for example:

```toml
[env.production]
name = "physiocoach-ai-api"
workers_dev = true
routes = [
  { pattern = "physiocoach-ai-api.otconnect.ir", custom_domain = true }
]
```

## Manual Deployment

Deploy dev manually:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:dev
pnpm deploy:dev
```

Verify dev manually:

```sh
curl -i https://physiocoach-ai-api-dev.otconnect.ir/api/v1/health
curl -i -X OPTIONS "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/assessments" \
  -H "Origin: https://physiocoach.otconnect.ir" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Expected:

- health returns `HTTP/2 200`
- preflight returns `HTTP/2 204`
- preflight includes `Access-Control-Allow-Origin: https://physiocoach.otconnect.ir`

Deploy production manually:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:prod
pnpm deploy:prod
```

## Smoke Verification

After each deploy run:

```sh
AUTH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api:dev
AUTH_ACCESS_TOKEN=<jwt-access-token> pnpm smoke:api:prod
pnpm smoke:api
```

Expected:

- `health` returns `ok: true`
- `workout-plans/current` CORS preflight succeeds
- repeated `workout-sessions` create call with same `Idempotency-Key` returns same session id

If you do not provide a token, only the public checks run.

## Troubleshooting

### Browser Shows CORS but Cloudflare Is the Real Problem

If Chrome shows CORS/504 and no Worker logs appear, check the API directly:

```sh
curl -i https://physiocoach-ai-api-dev.otconnect.ir/api/v1/health
```

If it returns `302` to `*.cloudflareaccess.com`, Cloudflare Access is protecting
the Worker hostname. Turn Access off for the Worker URL in:

```text
Cloudflare Dashboard > Workers & Pages > Worker > Domains > Worker URL > Access
```

If it returns `error code: 1101` but `wrangler dev --remote` works, use the custom
domain route instead of `workers.dev`.

## Husky Pre-Push Sync

The API repo includes `pre-push` hook configured with Husky:

```text
pre-push:
  pnpm run sync:envs
```

It updates `.dev.vars` and `.prod.vars` from their matching `.env.*.example` files,
keeps existing secret values, and blocks push if tracked env artifacts changed.

### No Logs in `wrangler tail`

If `wrangler tail --env dev` receives no logs while requests fail, the request may
be blocked before the Worker runs. Check Cloudflare Access and the Worker Domains
Access toggle first.

### Wrangler Environment Warning

If Wrangler warns that top-level vars are not inherited by `env.dev`, copy the
needed value into `[env.dev.vars]`. Environment-specific vars are isolated.
