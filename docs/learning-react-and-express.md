# Learning React & Express through PhysioCoach AI

Senior-track curriculum: you already know HTTP, auth architecture, SQL, validation, testing,
and DI-style wiring. This doc teaches only what is *specific to these two frameworks* — their
execution models, their sharp edges, and their idioms — using this repo as the specimen.
No mapping to any prior stack; everything stands on its own terms.

---

## Part 1 — React: the execution model (web app)

The mental shift that matters: a component is a **function called on every render**, and its
local state lives outside it. Everything else follows from that.

### Phase A — Render → commit → effects

Read, in order:

1. `src/main.tsx` — mount point, `<StrictMode>` (dev-only double-invocation of render +
   effects: your code must be safe to run twice), provider stacking order.
2. `src/components/ui/Button.tsx` — props as an immutable input object; conditional JSX;
   `forwardRef` (refs are an escape hatch around the "render is pure" rule); the
   lookup-record pattern for variant styling.
3. `src/pages/AuthPage.tsx` — the state lifecycle around an async action:
   `setLoading(true)` → await → `setLoading(false)` in `finally`, plus `navigate()` after
   success. Note state updates are **batched** and each triggers a re-render with fresh props.

**Mechanics to internalize (verify each in code):**
- Render must be pure: same props/state in → same JSX out. Side effects never go in the
  render body.
- State is a **snapshot per render**. Any closure created during render sees that render's
  values forever (this produces "stale closure" bugs later).
- Re-render = React calls your function again, diffs the returned tree, patches the DOM.
  It is cheap; don't fear it, fear *unnecessary subtree* re-renders (Phase C).
- Keys: list identity by `key`, not index — see any `.map(...)` in `DashboardPage.tsx`.

### Phase B — Hooks semantics (`src/context/AuthContext.tsx`)

This one file demonstrates nearly every hook rule you need:

- `useState` — including the updater form `setUser(prev => ...)` used in `updateUser`.
- `useEffect(fn, deps)`:
  - deps compared with `Object.is`; missing deps = stale data, extra deps = extra runs.
  - **cleanup function** — both listeners are removed on unmount (lines ~44–49).
  - **async race protection** — the `cancelled` flag guards against setting state after the
    component lost interest during `await apiClient.get('auth/me')`.
  - StrictMode runs this effect twice in dev: notice nothing breaks because cleanup is right.
- `useCallback` / `useMemo` — why `login/register/logout/value` are memoized before going
  into the provider (next bullet).
- Context re-render semantics: when `value` changes identity, **every consumer re-renders**.
  Memoization keeps identity stable across unrelated provider renders. Then note the design
  tension: auth state changes rarely, so one context is fine here; high-frequency state would
  demand context splitting.
- Custom hook contract: `useAuth()` throws outside the provider — turning misuse into a
  crash-at-development-time instead of silent `undefined`.

### Phase C — Routing & data flow

- `src/router.tsx` — declarative route config; layout routes + `<Outlet />`; guards
  (`ProtectedRoute`) are just components making a render-time decision; `replace` on
  redirects so Back doesn't replay them.
- `src/App.tsx` — shell layout; pages mount inside `<Outlet />`.
- `src/services/api-client.ts` — read slowly, twice:
  - single-flight refresh mutex via shared `refreshPromise`;
  - in-flight GET deduplication with `Map<string, Promise>`;
  - service layer ↔ React bridge via `CustomEvent`s instead of imports (decoupling:
    plain TS module, zero React dependency).
- Skim `PreferencesContext.tsx` for a second context example, then `SessionPage.tsx` +
  `RestTimerHUD.tsx` for timers/intervals — the classic stale-closure trap in motion.

### React exercises

1. **Stale closure, on purpose:** in `RestTimerHUD`, build a timer that logs elapsed seconds
   from a state variable captured in the interval callback. Watch it report stale values;
   fix it two ways (ref, functional setState). Understand *why* each works.
2. **Race condition:** add a search-as-you-type box on a new `/exercises` page
   (`GET /api/v1/exercises`). Type fast, out-of-order responses will clobber each other until
   you add cancellation/last-request-wins. Implement it.
3. **Context cost:** temporarily remove `useMemo` from `AuthContext.value`, add a render
   counter log in a leaf component, observe the re-render wave on every keystroke elsewhere,
   restore it. You now know when memoization is load-bearing.
4. **Composition:** extend `Modal.tsx` usage to build a confirm-dialog wrapper
   (children + render props or compound components — pick one idiom and justify it).

---

## Part 2 — Express: middleware as composition (API)

### Phase A — The request pipeline (`src/app.ts`)

Read top-to-bottom and trace one request through:

- `app.use(...)` registers functions `(req, res, next)`; the chain is the framework.
- Order is semantics: `cors()` before routes; `express.json()` before anything reads a body;
  trace-id middleware stamps `req.traceId` for everything downstream; `authMiddleware`
  annotates `req.user` so routes can assume it; `errorHandler` last because errors travel
  *downward* through `next(error)`.
- Mounting: `app.use('/api/v1', authRouter)` — path prefix stripping, router-level chains.
- The alias middleware (rewrites `req.url`) shows middleware as *request transformation*, not
  just gating.

### Phase B — Routes & validation

1. `routes/health.ts` — smallest complete route.
2. `routes/validation.ts` + zod schemas at the top of `routes/auth.ts` — parse, don't
   validate-by-hand; a thrown `ZodError` becomes a 400 automatically (Phase D).
3. `routes/exercise-catalog.ts` — query params, Drizzle reads, response shaping.
4. Route shape discipline: thin controller (parse → delegate → respond); logic lives in
   `services/` and `auth/`.

### Phase C — Async handlers & error propagation

- Handlers here are `async`; the adapter (`routes/express-adapter.ts`) try/catches and calls
  `next(error)` — study that wrapper. Know what happens when an async route rejects with and
  without such wrapping in Express 5.
- `middleware/error.ts` — one typed funnel: `ZodError` → 400, `AuthError` → its status,
  `.status` passthrough, else 500; emits RFC 7807 `application/problem+json` with traceId.
- Full-stack symmetry: `ApiError` in `api-client.ts` parses exactly that envelope. Trace one
  error end-to-end (throw → funnel → fetch client → toast).

### Phase D — Auth internals & data layer

You know OAuth/JWT/sessions architecturally; study the concrete engineering choices:

- `auth/tokens.ts` (jose signing/verification), `auth/sessions.ts` (**rotating** refresh
  tokens stored hashed + reuse detection → family revocation; pairs with the frontend's
  single-flight refresh), `auth/password.ts` (+ the dummy-hash compare defeating user
  enumeration timing attacks in `routes/auth.ts`), `auth/rate-limit.ts`.
- `db/schema.ts` — Drizzle: tables as typed objects, FK cascades, composite PKs;
  queries via `eq()/and()` from `drizzle-orm`; migrations generated from schema
  (`npm run db:generate` → `db:migrate:*`).
- `services/workout-generator/` — nondeterministic LLM output tamed behind zod contracts
  (`plan-validator.ts`, `workout-plan-contract.ts`) before persistence.
- Deployment twist (read once, late): `index.ts` bridges this Node server onto Cloudflare
  Workers; `express-adapter.ts` lets handlers return web-standard `Response`. Ignore until
  Express itself feels native.

### Express exercises

1. New router with a POST endpoint: zod-parse the body, deliberately return invalid input,
   inspect the problem+json response; then throw a raw `Error` and watch it become a 500 with
   the same envelope.
2. Middleware of your own: a request logger stamping duration into a response header, placed
   correctly relative to routers (justify the position).
3. Add a nullable column to a table, generate + apply migration locally, expose it through a
   route, verify with a test modeled on `tests/express-app.test.ts`.
4. Write one vitest integration test for an existing route using the app's `.fetch()` harness.

---

## Part 3 — Capstone: narrate the sign-in round trip

```
AuthPage submit
  → useAuth().login()                    context/AuthContext.tsx
    → apiClient.post('auth/login')       services/api-client.ts
      → fetch POST /api/v1/auth/login    vite proxy :5173 → :8787
        → cors → json → traceId → authMiddleware → aliases
          → zod parse → rate limit → getUserByEmail
          → dummy-hash compare → rotateSession → signAccessToken
        ← { accessToken, refreshToken, user }
      ← storeSession: localStorage + setState (identity flip → re-render)
  → navigate('/dashboard')               ProtectedRoute now passes
Later: 401 mid-session
  → api-client single-flight refresh → retry original GET
  → 'auth:session-updated' CustomEvent → AuthContext listener syncs token
```

If you can narrate this without opening the files — including *why* each layer exists —
you're done with fundamentals. Move to building.

## Pace

| Week | Focus | Proof of progress |
|---|---|---|
| 1 | Phases A–B + run both apps | Exercise 1 (stale closure) done |
| 2 | Phases B–C + routing/client | Exercises 2–3 done |
| 3 | Express Phases A–D | Exercises 1–2 done |
| 4 | DB + tests + capstone narration | Exercise 4 + capstone |

## Ground rules
- Break things deliberately: remove a dep from a `useEffect` array, reorder two middlewares,
  drop `errorHandler`. Predict the failure first, then verify.
- API keys stay server-side; never commit `.env*`.
