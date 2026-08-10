# Web Deployment

Current Cloudflare Pages deployment:

```text
Production web: https://physiocoach.otconnect.ir
Development web: https://dev.physiocoach-ai-web.pages.dev
Production API: https://physiocoach-ai-api.otconnect.ir/api/v1
Development API: https://physiocoach-ai-api-dev.otconnect.ir/api/v1
Auth provider: first-party API JWT + rotating refresh tokens
AI provider: OpenRouter through the Cloudflare Worker
```

## Cloudflare Pages

Use Cloudflare Pages for the frontend.

```text
Build command: pnpm build
Build output directory: dist/physiocoach-ai-web/browser
```

Branch/domain mapping:

```text
dev  -> https://dev.physiocoach-ai-web.pages.dev
prod -> https://physiocoach.otconnect.ir
```

The frontend runtime config is generated at build time by
`scripts/write-runtime-config.mjs` into `public/config.js`.

## Runtime Variables

Set these Pages variables:

```text
# dev
NG_APP_ENV=development
NG_APP_API_BASE_URL=https://physiocoach-ai-api-dev.otconnect.ir/api/v1

# production
NG_APP_ENV=production
NG_APP_API_BASE_URL=https://physiocoach-ai-api.otconnect.ir/api/v1
```

Local env files use the same values:

```text
.env.dev
.env.production
```

`public/config.js` is gitignored and must not be committed. See
`public/config.example.js` for the expected shape.

## Verification

After deploy:

```bash
curl -s "https://physiocoach.otconnect.ir/config.js?check=$(date +%s)"
curl -s "https://dev.physiocoach-ai-web.pages.dev/config.js?check=$(date +%s)"
pnpm smoke:web:prod
pnpm smoke:web:dev
```

Expected production config:

```js
window.__PHYSIOCOACH_CONFIG__ = {
  apiUrl: 'https://physiocoach-ai-api.otconnect.ir/api/v1',
  environment: 'production',
};
```

Expected development config:

```js
window.__PHYSIOCOACH_CONFIG__ = {
  apiUrl: 'https://physiocoach-ai-api-dev.otconnect.ir/api/v1',
  environment: 'development',
};
```

## API Checks

```bash
curl -i https://physiocoach-ai-api-dev.otconnect.ir/api/v1/health
curl -i -X OPTIONS "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/assessments" \
  -H "Origin: https://dev.physiocoach-ai-web.pages.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"

curl -i https://physiocoach-ai-api.otconnect.ir/api/v1/health
curl -i -X OPTIONS "https://physiocoach-ai-api.otconnect.ir/api/v1/assessments" \
  -H "Origin: https://physiocoach.otconnect.ir" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Expected:

- health returns `HTTP/2 200`
- preflight returns `HTTP/2 204`
- preflight includes `Access-Control-Allow-Origin` matching the request origin

## Safety catalog rollout verification

Before publishing a dev client, ask an API admin to verify the active catalog
coverage and required considerations (`knee_pain`, `lower_back_pain`, and
`high_impact_intolerance`) with the authenticated API smoke and
`API_SMOKE_ACTIVE_CATALOG_ID`. That API smoke sends a fixed severe-knee
generation request and compares returned exercise IDs to the admin avoid list.
In the browser,
create or edit a severe consideration, regenerate a plan, and confirm severity
persists after refresh while red exercises are absent. Then run:

```bash
pnpm validate
pnpm smoke:web:dev
```

This is a development verification path only. Catalog activation and rollback
remain API-admin operations; do not activate production as part of a web deploy.
Do not add third-party visual media to Pages or use it as a runtime fallback.

## Auth

The frontend uses the first-party Worker auth API. Email/password and Google
OAuth use `/auth/*` endpoints on the API Worker. Access tokens live only in
memory; rotating refresh tokens are persisted in browser storage.

Google OAuth redirect URIs:

```text
https://physiocoach-ai-api-dev.otconnect.ir/api/v1/auth/google/callback
https://physiocoach-ai-api.otconnect.ir/api/v1/auth/google/callback
```

Allowed OAuth return origins:

```text
https://dev.physiocoach-ai-web.pages.dev
https://physiocoach.otconnect.ir
```
