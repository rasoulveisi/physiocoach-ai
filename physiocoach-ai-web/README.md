# PhysioCoach AI Web

Angular PWA frontend for PhysioCoach AI.

Current free-tier dev deployment:

- Production web: `https://physiocoach.otconnect.ir`
- Dev web: `https://dev.physiocoach-ai-web.pages.dev`
- API (prod): `https://physiocoach-ai-api.otconnect.ir/api/v1`
- API (dev): `https://physiocoach-ai-api-dev.otconnect.ir/api/v1`
- Auth: first-party API JWT + rotating refresh tokens
- AI: OpenRouter through the Cloudflare Worker only

Do not call OpenRouter from Angular. The browser calls the Cloudflare Worker API,
and the Worker handles OpenRouter secrets, model fallback, validation, and CORS.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Workout plan behavior

Plan and onboarding calls always go through the Cloudflare Worker backend. The frontend
does not call OpenRouter directly.

- `POST /workout-plans/generate` receives AI output from the Worker and updates the
  current plan in the API-backed store.
- Generated plan parsing is resilient to mixed AI payload shapes for display and warning surfaces.
- The plan page now supports:
  - deleting the current plan from backend
  - fallback recovery via fresh generate or manual delete-and-regenerate flow
- Fallback and deterministic warning states are surfaced in the plan safety section.

## Generate API Client

Run the API locally, then:

```bash
API_OPENAPI_URL=http://localhost:8787/api/v1/openapi.json pnpm generate:api
```

## Validation

```bash
pnpm validate
```

`validate` runs lint + tests + build. Use `validate:core` when frontend tests are blocked by your local runtime.

## Local Release Check

```bash
pnpm validate
pnpm dev
```

Open `http://localhost:4200`. The landing page should load, `/auth` should render the email sign-in screen, and protected app routes should redirect unauthenticated users back to `/auth`.

## Local Test Troubleshooting

If your machine shows:

```
Error: Cannot find module @rollup/rollup-darwin-arm64 ... code signature in ... not valid for use in process: mapping process and mapped file (non-platform) have different Team IDs
```

the test runner is blocked by the local Node runtime used in this environment and is not a product logic failure.

Use these steps to run tests in a deterministic local way:

```bash
# 1) Use a standard system Node binary (same terminal command as your terminal)
node -v

# 2) Keep test command set:
pnpm lint
pnpm build
pnpm test

# Optional: run only core validation when Rollup native addons cannot load
pnpm validate:core
```

## Smoke Checks (Post-Deploy)

Run a fast web deployment smoke check:

```sh
pnpm smoke:web
pnpm smoke:web:dev
pnpm smoke:web:prod
```

This verifies:

- Site is reachable (`GET /`)
- `config.js` exists and contains:
  - `apiUrl`
  - `environment`

## Safety catalog rollout

The API owns catalog activation and safety enforcement. Before a dev rollout,
verify the API catalog coverage with an admin smoke token and
`API_SMOKE_ACTIVE_CATALOG_ID`; this smoke generates a fixed severe-knee request
and rejects any returned catalog ID marked avoid for that condition. Confirm the web
client renders and persists explicit mild, moderate, or severe consideration
severity. Run `pnpm validate` and `pnpm smoke:web:dev`; do not treat a web
deploy as authorization to activate a production catalog. Third-party visual media
is not a client fallback: only approved stored media may be displayed.

## Cloudflare Pages Runtime Config

Cloudflare Pages generates `config.js` during the build from `NG_APP_*` environment
variables. After changing Cloudflare Pages environment variables, trigger a fresh deploy
and verify:

```bash
curl https://physiocoach.otconnect.ir/config.js
curl https://dev.physiocoach-ai-web.pages.dev/config.js
```

Expected dev values:

```js
window.__PHYSIOCOACH_CONFIG__ = {
  apiUrl: 'https://physiocoach-ai-api-dev.otconnect.ir/api/v1',
  environment: 'development',
};
```

Expected prod values:

```js
window.__PHYSIOCOACH_CONFIG__ = {
  apiUrl: 'https://physiocoach-ai-api.otconnect.ir/api/v1',
  environment: 'production',
};
```

If Chrome still calls an old API URL, hard refresh or unregister the service
worker for `physiocoach.otconnect.ir`.

## Husky Pre-Push Hook

Install dependencies once (this also installs Husky hooks), then every `git push`
runs `pnpm run sync:config` automatically to regenerate `public/config.js` for
local use.

```bash
pnpm install
```

> **Note:** `public/config.js` is gitignored and should **never** be committed.
> See `public/config.example.js` for the expected format.

## Production Release

```bash
git tag v0.7.0-deploy-ready
git push origin v0.7.0-deploy-ready
```

## Troubleshooting Runtime Config

If the app calls the wrong API, verify `NG_APP_API_BASE_URL` and the generated
`config.js` value for the active deployment environment.
