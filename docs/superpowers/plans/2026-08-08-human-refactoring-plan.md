# Incremental Domain-by-Domain Human Code Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `physiocoach-ai-api` and `physiocoach-ai-web` to follow clean, readable, idiomatic human software engineering patterns while preserving 100% of existing functionality and test suite passing.

**Architecture:** Refactor incrementally domain-by-domain (Infrastructure -> Auth & Profile -> Workouts -> Exercise Catalog & Safety -> Progress & Settings), eliminating repetitive AI `wrapRoute` handlers in favor of Hono `onError`, splitting massive service files, and adopting Angular Signals.

**Tech Stack:** TypeScript, Cloudflare Workers, Hono, Drizzle ORM, Angular 21 (PWA), Vitest, ESLint.

## Global Constraints

- Never add DDD abstraction layers (use-cases, repositories, domain-models). Keep code flat in `routes/`, `services/`, `db/`, `middleware/`, `types/`.
- All database queries must remain direct Drizzle queries in route handlers or service functions.
- Preserve 100% of API signatures, error payload shapes, and HTTP status codes.
- Validate backend (`npx pnpm validate` in `physiocoach-ai-api`) and frontend (`npx pnpm validate:core` in `physiocoach-ai-web`) at every checkpoint.

---

### Task 1: Infrastructure & Global Error Handling (Backend)

**Files:**
- Modify: `physiocoach-ai-api/src/app.ts`
- Modify: `physiocoach-ai-api/src/env.ts`
- Modify: `physiocoach-ai-api/src/shared/errors/api.ts`
- Test: `physiocoach-ai-api/tests/health.test.ts`
- Test: `physiocoach-ai-api/tests/cors.test.ts`

**Interfaces:**
- Consumes: Hono context and error types.
- Produces: Global `app.onError` formatter that transforms thrown exceptions into `{ error: { code, message, details, requestId } }` with proper HTTP status codes.

- [ ] **Step 1: Update Hono Context types in `src/env.ts` to include `Variables: { requestId: string }`**
- [ ] **Step 2: Update `src/app.ts` to utilize `app.onError` for central error formatting and clean up context casts**
- [ ] **Step 3: Run infrastructure tests to verify zero regressions**

Run: `npx vitest run tests/health.test.ts tests/cors.test.ts tests/env.test.ts` in `physiocoach-ai-api`
Expected: PASS

- [ ] **Step 4: Commit Infrastructure Changes**

```bash
git add physiocoach-ai-api/src/app.ts physiocoach-ai-api/src/env.ts physiocoach-ai-api/src/shared/errors/api.ts
git commit -m "refactor(api): centralize Hono error handling and clean up context types"
```

---

### Task 2: Auth & Profile Domain Refactoring (Backend & Frontend)

**Files:**
- Modify: `physiocoach-ai-api/src/routes/auth.ts`
- Modify: `physiocoach-ai-api/src/routes/profiles.ts`
- Modify: `physiocoach-ai-web/src/app/core/auth/auth.service.ts`
- Modify: `physiocoach-ai-web/src/app/core/auth/auth.store.ts`
- Test: `physiocoach-ai-api/tests/auth-routes.test.ts`
- Test: `physiocoach-ai-api/tests/auth-middleware.test.ts`

**Interfaces:**
- Consumes: Hono error handler and Auth credentials DB schema.
- Produces: Clean, readable Auth endpoints without `wrapRoute` boilerplate and modern signal-based frontend AuthStore.

- [ ] **Step 1: Refactor `physiocoach-ai-api/src/routes/auth.ts` to remove `wrapRoute` wrappers and clean up endpoint logic**
- [ ] **Step 2: Refactor `physiocoach-ai-api/src/routes/profiles.ts` to use direct Hono context and schema validation**
- [ ] **Step 3: Run backend Auth tests**

Run: `npx vitest run tests/auth-routes.test.ts tests/auth-middleware.test.ts` in `physiocoach-ai-api`
Expected: PASS

- [ ] **Step 4: Refactor `physiocoach-ai-web/src/app/core/auth/auth.store.ts` and `auth.service.ts` using `signal()`, `computed()`, and `inject()`**
- [ ] **Step 5: Run frontend core validation**

Run: `npx pnpm validate:core` in `physiocoach-ai-web`
Expected: PASS (lint & build pass)

- [ ] **Step 6: Commit Auth Domain Refactoring**

```bash
git add physiocoach-ai-api/src/routes/auth.ts physiocoach-ai-api/src/routes/profiles.ts physiocoach-ai-web/src/app/core/auth/
git commit -m "refactor(auth): simplify auth and profile handlers and convert auth store to signals"
```

---

### Task 3: Workouts Domain Refactoring (Plans, Sessions & Generator)

**Files:**
- Modify/Split: `physiocoach-ai-api/src/services/workout-generator.ts` -> modular helpers in `physiocoach-ai-api/src/services/workout-generator/`
- Modify: `physiocoach-ai-api/src/routes/workout-plans.ts`
- Modify: `physiocoach-ai-api/src/routes/workout-sessions.ts`
- Modify: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.store.ts`
- Modify: `physiocoach-ai-web/src/app/features/workout-session/workout-session.page.ts`
- Test: `physiocoach-ai-api/tests/workout-session-service.test.ts`
- Test: `physiocoach-ai-api/tests/openrouter-provider-structured.test.ts`

**Interfaces:**
- Consumes: OpenRouter provider and Drizzle DB schemas for workout plans & sessions.
- Produces: Decomposed `workout-generator` service modules and clean workout route handlers.

- [ ] **Step 1: Modularize `workout-generator.ts` by decomposing giant functions into focused prompt, validation, and transformation helpers**
- [ ] **Step 2: Refactor `workout-plans.ts` and `workout-sessions.ts` route handlers to remove `wrapRoute` and simplify request validation**
- [ ] **Step 3: Run backend workout unit and integration tests**

Run: `npx vitest run tests/workout-session-service.test.ts tests/openrouter-provider-structured.test.ts tests/schemas/workout-plan.schema.test.ts` in `physiocoach-ai-api`
Expected: PASS

- [ ] **Step 4: Modernize frontend `WorkoutPlanStore` and `WorkoutSessionPage` using Angular Signals**
- [ ] **Step 5: Run frontend core validation**

Run: `npx pnpm validate:core` in `physiocoach-ai-web`
Expected: PASS

- [ ] **Step 6: Commit Workouts Domain Refactoring**

```bash
git add physiocoach-ai-api/src/services/workout-generator* physiocoach-ai-api/src/routes/workout-* physiocoach-ai-web/src/app/features/workout-*
git commit -m "refactor(workout): decompose workout generator service and update workout stores to signals"
```

---

### Task 4: Exercise Catalog & Safety Domain Refactoring

**Files:**
- Modify: `physiocoach-ai-api/src/routes/admin-catalog.ts`
- Modify: `physiocoach-ai-api/src/routes/exercise-catalog.ts`
- Modify: `physiocoach-ai-web/src/app/features/exercise-catalog/exercise-catalog.page.ts`
- Test: `physiocoach-ai-api/tests/exercise-catalog-routes.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-catalog-workflow.integration.test.ts`

**Interfaces:**
- Consumes: D1 SQL exercise catalog schema and safety analyzers.
- Produces: Clean exercise catalog endpoints and Signal-based frontend catalog components.

- [ ] **Step 1: Refactor `admin-catalog.ts` and `exercise-catalog.ts` to remove `wrapRoute` and clean up query execution**
- [ ] **Step 2: Run catalog integration tests**

Run: `npx vitest run tests/exercise-catalog-routes.test.ts tests/exercise-catalog-workflow.integration.test.ts` in `physiocoach-ai-api`
Expected: PASS

- [ ] **Step 3: Modernize frontend catalog components with signals**
- [ ] **Step 4: Commit Catalog Domain Refactoring**

```bash
git add physiocoach-ai-api/src/routes/admin-catalog.ts physiocoach-ai-api/src/routes/exercise-catalog.ts physiocoach-ai-web/src/app/features/exercise-catalog/
git commit -m "refactor(catalog): streamline exercise catalog API endpoints and catalog views"
```

---

### Task 5: Progress, Body Measurements & Settings Domain Refactoring

**Files:**
- Modify: `physiocoach-ai-api/src/routes/progress.ts`
- Modify: `physiocoach-ai-api/src/routes/body-measurements.ts`
- Modify: `physiocoach-ai-api/src/routes/settings.ts`
- Modify: `physiocoach-ai-web/src/app/features/progress/progress.page.ts`
- Modify: `physiocoach-ai-web/src/app/features/measurements/measurements.page.ts`
- Modify: `physiocoach-ai-web/src/app/features/settings/settings.page.ts`
- Test: All backend tests (`npx pnpm test` in `physiocoach-ai-api`)
- Test: All frontend lint and build (`npx pnpm validate:core` in `physiocoach-ai-web`)

**Interfaces:**
- Consumes: Progress calculator services and body measurement schemas.
- Produces: Fully refactored, clean, human-like codebase across API and Web apps.

- [ ] **Step 1: Refactor progress, body measurement, and settings backend routes**
- [ ] **Step 2: Modernize frontend progress, measurements, and settings pages using Signals**
- [ ] **Step 3: Run comprehensive backend validation pass (`npx pnpm validate`)**

Run: `npx pnpm validate` in `physiocoach-ai-api`
Expected: PASS (all 326+ tests pass, lint passes, tsc passes)

- [ ] **Step 4: Run comprehensive frontend validation pass (`npx pnpm validate:core`)**

Run: `npx pnpm validate:core` in `physiocoach-ai-web`
Expected: PASS (lint & build pass)

- [ ] **Step 5: Final Commit**

```bash
git add physiocoach-ai-api/ physiocoach-ai-web/
git commit -m "refactor: complete incremental domain-by-domain human developer code cleanup"
```
