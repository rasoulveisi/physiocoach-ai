# Cloudflare Edge Fullstack Manager v3.7.0 — Master Migration & Modernization Plan

This plan incorporates the latest **`cloudflare-edge-fullstack-manager` v3.7.0** specifications, the target **Neon PostgreSQL** database (`ep-quiet-thunder-ax8hxhfy-pooler.c-4.us-east-2.aws.neon.tech`), and provides a complete architectural blueprint for PhysioCoach AI.

---

## 1. Executive Architecture Comparison (v3.7.0 Target vs Current)

| Stack Component | Current PhysioCoach AI | Skill Target (v3.7.0) | Migration Scope & Impact |
| :--- | :--- | :--- | :--- |
| **Database** | Cloudflare D1 (SQLite) | Neon PostgreSQL via Hyperdrive | **Direct Migration**: Convert 23 active tables to `pgTable`, booleans to native `boolean`, push via `drizzle-kit push`, migrate data from D1. |
| **Backend Framework** | Hono (`^4.12.23`) on Workers | Express.js (`^5.0.0`) on Workers (`cloudflare:node`) | **Rewrite Step 4**: Re-implement active routes in Express 5 using `httpServerHandler` or keep high-performance Hono with Hyperdrive adapter. |
| **DB Driver & Pooling** | `drizzle-orm/d1` | `postgres.js` (`^3.4.4`) + `drizzle-orm/postgres-js` | **Required**: Instantiate per-request `{ max: 1, idle_timeout: 0, connect_timeout: 10 }` via Hyperdrive. |
| **Frontend Framework** | Angular 21 PWA (54 TS files, PrimeNG) | React 19 + Vite + Tailwind CSS + React Router | **Modernization Step 5**: Re-implement 7 active core views (Landing, Auth, Onboarding, Dashboard, Plan, Session, Settings/Admin) into React. |
| **Routing / Proxy** | Angular API client + CORS middleware | `frontend/public/_redirects` same-origin proxy | **Same-Origin Proxying**: Eliminates browser CORS preflights and manages client-side SPA routing cleanly. |
| **Configuration** | `wrangler.toml` (Worker) + `wrangler.jsonc` (Pages) | `wrangler.jsonc` with `"compatibility_date": "2026-06-30"` | **Config Standard**: Configure `hyperdrive` bindings and `nodejs_compat` flag in `wrangler.jsonc`. |

---

## 2. Neon Database Connection Details

The database endpoint configured for this deployment:
- **Neon Host**: `ep-quiet-thunder-ax8hxhfy-pooler.c-4.us-east-2.aws.neon.tech`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **SSL / Security**: `sslmode=require&channel_binding=require`
- **Direct Connection URL**: `postgresql://neondb_owner:npg_T7m0LDSedrvi@ep-quiet-thunder-ax8hxhfy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require`

---

## 3. Detailed Step-by-Step Modernization Strategy

```mermaid
graph TD
    subgraph Step 1: Data & DB
        D1[Export D1 SQLite Data] --> PGSchema[Define Drizzle pgTable Schema]
        PGSchema --> NeonPush[drizzle-kit push to Neon]
        NeonPush --> Hyperdrive[Provision CF Hyperdrive Pool]
    end

    subgraph Step 2: Backend Modernization
        Hyperdrive --> BackendClient[Setup postgres.js per-request client in getDb]
        BackendClient --> BackendRoutes[Active Express 5 / Hono Endpoints]
        BackendRoutes --> BackendTypes[Run wrangler types & tsc]
    end

    subgraph Step 3: Frontend Modernization
        BackendRoutes --> ReactVite[Scaffold React 19 + Vite + Tailwind]
        ReactVite --> ReactPages[Implement 7 Active Feature Flows]
        ReactPages --> Redirects[Configure public/_redirects SPA proxy]
    end

    subgraph Step 4: Cleanup & Verification
        ReactPages --> Purge[Purge dead routes & legacy angular files]
        Purge --> E2E[End-to-End Test Suite & Build Verification]
    end
```

---

## 4. Work Breakdown by Component

### A. Database Migration (D1 SQLite &rarr; Neon PostgreSQL)

#### 1. Schema Dialect Conversion (`src/db/schema.ts`)
- Replace `drizzle-orm/sqlite-core` with `drizzle-orm/pg-core` (`pgTable`, `text`, `integer`, `real`, `boolean`, `timestamp`).
- Convert 15 integer boolean flags to native PostgreSQL `boolean()`:
  - `exercise_logs.completed`: `boolean('completed').notNull().default(false)`
  - `user_settings.reminders_enabled`: `boolean('reminders_enabled').notNull().default(false)`
  - `user_settings.auto_start_rest_timer`: `boolean('auto_start_rest_timer').notNull().default(true)`
  - `user_settings.rest_timer_sound_enabled`: `boolean('rest_timer_sound_enabled').notNull().default(true)`
  - `body_considerations.active` & `severity_enabled`: `boolean(...).notNull().default(true)`
  - `assessment_considerations.inferred`: `boolean('inferred').notNull().default(false)`
  - `exercise_safety_profiles.coverage_complete` & `manual_override`: `boolean(...).notNull().default(false)`
  - `exercise_consideration_ratings.manual_override`: `boolean(...).notNull().default(false)`
  - `exercise_muscles.is_primary`: `boolean('is_primary').notNull().default(true)`
- Purge zombie schema definitions (`exercise_aliases`, `exercise_duplicate_review_groups`, `exercise_analysis_runs`, `exercise_analysis_evidence`).

#### 2. Drizzle Configuration & Migration (`drizzle.config.ts`)
- Set `dialect: 'postgresql'`.
- Point `dbCredentials.url` to the Neon connection string in `.dev.vars` / `process.env`.
- Push schema directly using `npx drizzle-kit push`.

---

### B. Backend Modernization & Edge Runtime (`physiocoach-ai-api`)

#### 1. Per-Request Client Lifecycle (`src/db/index.ts` or `src/db/client.ts`)
Adhere strictly to Cloudflare Worker I/O isolation rules:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function getDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}
```

#### 2. Hyperdrive Worker Binding (`wrangler.jsonc` / `wrangler.toml`)
- Bind Hyperdrive with `localConnectionString`:
```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<HYPERDRIVE_ID>"
localConnectionString = "postgresql://neondb_owner:npg_T7m0LDSedrvi@ep-quiet-thunder-ax8hxhfy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

#### 3. Route Handler Simplification & Deduplication
- Preserve all 26 active endpoints verified by frontend audit.
- Remove confirmed orphaned routes (`GET /me`, `GET /assessments` stub, `GET /admin/not-found`).
- Deduplicate shared profile functions (`mapProfileRecordToInput`, `getLatestProfileForUser`, `upsertUserAndProfile`) into `src/services/user-profile.ts`.
- Deduplicate `hasExplicitConsiderations` into `src/types/assessment.ts`.
- Remove production `console.log('INDEX_FETCH_PATH', ...)` from `src/index.ts`.

---

### C. Frontend Modernization (`physiocoach-ai-web` &rarr; React 19 + Vite)

If executing full Step 5 Modernization:
1. **Scaffold Vite React-TS Project**:
   - React 19 + TypeScript + Tailwind CSS + Lucide Icons.
2. **Re-implement Core Feature Pages**:
   - `LandingPage`: Marketing hero, features overview, CTAs.
   - `AuthPage`: Email/password login, registration, session storage.
   - `OnboardingPage`: Step-by-step biometric intake, goals, equipment, and consideration picker.
   - `DashboardPage`: Overview metrics, next workout teaser, weekly compliance summary.
   - `WorkoutPlanPage`: Current active workout split, day details, exercise rationale, and progression.
   - `WorkoutSessionPage`: Live workout tracker with set completion, RPE, rest timers, and exercise swapping.
   - `SettingsPage`: Unit system, theme preferences, timer settings.
   - `AdminPage`: System health and operational controls.
3. **Same-Origin Redirects**:
   - Add `public/_redirects`:
     ```text
     /api/*  https://physiocoach-ai-api.otconnect.ir/:splat  200
     /*      /index.html                                     200
     ```

---

## 5. Phased Execution Roadmap

### Option 1: Full Rewrite (v3.7.0 Strict: React 19 + Express 5 + Neon)
- **Phase 1**: Push schema to Neon & configure Hyperdrive.
- **Phase 2**: Migrate SQLite data to Neon.
- **Phase 3**: Rewrite backend router to Express 5 (`cloudflare:node`) with per-request `postgres.js`.
- **Phase 4**: Rebuild frontend in React 19 + Vite + Tailwind.
- **Phase 5**: Purge Angular artifacts & validate builds.

### Option 2: Pragmatic Hybrid (Recommended: Neon DB + Clean Hono + Keep Angular PWA)
- **Phase 1**: Migrate database layer from D1 to Neon PostgreSQL via Hyperdrive.
- **Phase 2**: Update backend Drizzle ORM client to postgres.js and fix boolean handling.
- **Phase 3**: Clean dead code, eliminate function duplication, and purge zombie tables.
- **Phase 4**: Keep Angular 21 PWA intact, avoiding complete UI re-writes while reaping 100% of the database and backend architectural benefits.

---

## 6. Verification & Quality Gates

Before finalizing:
1. **Schema Check**: `npx drizzle-kit push` runs cleanly against the Neon database.
2. **Backend Type Check**: `npx tsc --noEmit` and `npx wrangler types` exit with code 0.
3. **Backend Validation**: `npm run validate` (lint + vitest unit tests).
4. **Frontend Production Build**: `npm run build` generates clean distribution bundle in `dist/`.
5. **End-to-End Active Flow**: Verify account registration, login, plan generation, and workout session logging against Neon PostgreSQL.
