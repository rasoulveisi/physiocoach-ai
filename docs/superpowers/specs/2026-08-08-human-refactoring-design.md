# Human Developer Code Refactoring Design Specification

- **Date**: 2026-08-08
- **Project**: PhysioCoach AI (`physiocoach-ai-api` & `physiocoach-ai-web`)
- **Strategy**: Incremental Domain-by-Domain Refactoring (Approach 3)
- **Goal**: Refactor the codebase to make it look like it was authored by an experienced human developer—clean, readable, idiomatic, type-safe, and free of repetitive AI boilerplate—while preserving 100% of application behavior and passing all unit and integration tests.

---

## 1. Architectural & Refactoring Principles

1. **Strict Flat Architecture Compliance**:
   - Abide by [.agents/AGENTS.md](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/.agents/AGENTS.md) rules:
     - No DDD/Clean Architecture abstraction layers (`repositories`, `use-cases`, `domain-models`).
     - Backend code remains strictly in `src/routes/`, `src/services/`, `src/db/`, `src/middleware/`, `src/types/`.
     - Direct Drizzle database queries in route handlers and service functions without extra wrapper abstractions.
     - No re-export files (`export * from ...`). Direct imports only.

2. **Eliminate Repetitive AI Boilerplate & Wrappers**:
   - Centralize Hono error handling using `app.onError()` in `src/app.ts` so route handlers do not need repetitive `wrapRoute(c, async () => { ... })` wrapping.
   - Standardize Hono Context generics for custom request state (e.g. `c.set('requestId', ...)` instead of `(c as unknown as ...).set(...)`).
   - Clean up excessive, redundant try-catch blocks and manual validation cascades.

3. **Service & Module Right-Sizing**:
   - Decompose monolithic service files (like `src/services/workout-generator.ts`, 75.6 KB) into cohesive, logically bounded helper modules under `src/services/workout-generator/` (e.g., `prompt-builder.ts`, `schema-validator.ts`, `plan-transformer.ts`).
   - Extract cleanly named, single-responsibility helper functions instead of deeply nested anonymous closures.

4. **Idiomatic Frontend Code (Angular 21)**:
   - Modernize state management using Angular Signals (`signal()`, `computed()`) and `inject()` syntax.
   - Remove redundant RxJS subscription glue code and manual state synchronization boilerplate in stores and page components.

5. **Behavior & Test Parity**:
   - Preserve 100% of API endpoints, HTTP status codes, error payload schemas, and response formats.
   - Run local validation commands (`npx pnpm validate` in `physiocoach-ai-api` and `npx pnpm validate:core` in `physiocoach-ai-web`) after every single domain phase.

---

## 2. Incremental Domain Refactoring Phases

### Phase 0: Infrastructure & Global Error Handling Refactoring
- **Backend Infrastructure (`src/app.ts`, `src/shared/errors/api.ts`)**:
  - Update `src/app.ts` to configure `app.onError()` to format all thrown errors into `ErrorResponsePayload` with `requestId`.
  - Type `requestId` in Hono's Environment context interface.
  - Simplify CORS configuration and middleware binding.

### Phase 1: Auth & User Profile Domain
- **Backend (`src/routes/auth.ts`, `src/routes/profiles.ts`, `src/auth/*`)**:
  - Remove manual `wrapRoute` wrappers from `auth.ts` and `profiles.ts`.
  - Refactor route handlers to use direct Hono context methods and typed Zod schema parsing.
  - Clean up password/session helper methods in `src/auth/sessions.ts` and `src/auth/password.ts`.
- **Frontend (`src/app/core/auth/*`, `src/app/features/auth/*`)**:
  - Refactor `AuthService` and `AuthStore` to use Angular Signals (`signal`, `computed`) and `inject()`.
  - Simplify guard implementations (`auth.guard.ts`, `admin.guard.ts`).
- **Validation Checkpoint**: Run backend test suite (`npx pnpm test`) and frontend lint/build.

### Phase 2: Workouts Domain (Generation, Plans & Sessions)
- **Backend (`src/routes/workout-plans.ts`, `src/routes/workout-sessions.ts`, `src/services/workout-generator.ts`, `src/services/workout-session.ts`)**:
  - Modularize `workout-generator.ts` into clean, well-bounded modules within `src/services/workout-generator/`.
  - Refactor route handlers in `workout-plans.ts` and `workout-sessions.ts` for clean readability, removing `wrapRoute` boilerplate.
- **Frontend (`src/app/features/workout-plan/*`, `src/app/features/workout-session/*`)**:
  - Refactor `WorkoutPlanStore` and `WorkoutSessionPage` to use clean signal-based state and clean error notification patterns.
- **Validation Checkpoint**: Run backend AI contract tests & workout session tests, plus frontend build.

### Phase 3: Exercise Catalog & Safety Domain
- **Backend (`src/routes/exercise-catalog.ts`, `src/routes/admin-catalog.ts`, `src/services/exercise-*.ts`)**:
  - Clean up `admin-catalog.ts` (23.6 KB) by extracting dataset mapping, attribute derivation, and safety rule application into cleanly structured service functions.
  - Remove redundant try/catch wrappers and manual SQL query duplication.
- **Frontend (`src/app/features/exercise-catalog/*`, `src/app/features/admin/*`)**:
  - Modernize catalog components and stores using Signals and clean PrimeNG integration.
- **Validation Checkpoint**: Run exercise catalog integration tests (`exercise-catalog-workflow.integration.test.ts`, `exercise-safety-cli.test.ts`).

### Phase 4: Progress, Body Measurements & Settings Domain
- **Backend (`src/routes/progress.ts`, `src/routes/body-measurements.ts`, `src/routes/settings.ts`, `src/services/progress-calculator.ts`)**:
  - Refactor calculation logic and route handlers to be concise, functional, and self-documenting.
- **Frontend (`src/app/features/progress/*`, `src/app/features/measurements/*`, `src/app/features/settings/*`)**:
  - Modernize chart/measurement components to use signals and reactive forms without boilerplate getters.
- **Validation Checkpoint**: Run full backend test suite (`326+ tests`) and frontend core validation (`validate:core`).

---

## 3. Verification & Acceptance Criteria

1. **Zero Regression**: All 326 backend tests in `physiocoach-ai-api` pass without any code modifications to test expectations.
2. **Frontend Pass**: `physiocoach-ai-web` passes `pnpm lint` and `pnpm build` cleanly without type errors.
3. **No Structural Violation**: Code adheres to direct Drizzle queries and Hono route conventions without introducing DDD layers.
4. **Code Quality**: Functions are concise, typed, free of hacky type coercions, and follow human software engineering best practices.
