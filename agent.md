# PhysioCoach AI: Agent Onboarding & Project Guide

Welcome! This document is designed to onboard AI agents and developers to the **PhysioCoach AI** project. Read this document carefully upon workspace initialization to understand the project architecture, tech stack, directory structure, setup commands, and implementation constraints.

---

## 1. Project Overview

**PhysioCoach AI** is an AI-powered physiotherapy and workout coaching platform. It is split into two primary components:
1. **Frontend (`physiocoach-ai-web`)**: An Angular PWA hosted on Netlify, using PrimeNG and Tailwind CSS.
2. **Backend API (`physiocoach-ai-api`)**: A Hono REST API running on Cloudflare Workers, using Drizzle ORM to interface with a Cloudflare D1 SQL database.

### Core Stack
- **Authentication**: Clerk (integrated into frontend; Bearer JWT validated in API middleware).
- **Database**: Cloudflare D1 (SQLite-compatible serverless database) + Drizzle ORM.
- **AI Generation**: OpenRouter endpoint calls from the Worker only. No client-side LLM calls are allowed.

---

## 2. Repository Structure

The project has a monorepo-style folder layout:

```
/Users/rasoul/rasoul/PhysioCoach Ai/
├── docs/                                  # Global architecture documentation
│   └── architecture-new-app-guide.md      # Reference blueprint for this architecture
├── physiocoach-ai-api/                    # Backend API (Cloudflare Worker)
│   ├── src/                               # Application source code
│   │   ├── modules/                       # Domain modules (ai, workout, safety, etc.)
│   │   ├── db/                            # Database schema and Drizzle migrations
│   │   ├── routes/                        # Hono routes and API endpoints
│   │   └── app.ts                         # App entry and middleware setup
│   ├── scripts/                           # Utility scripts (sync-envs, smoke checks)
│   └── wrangler.toml                      # Wrangler Worker configuration
└── physiocoach-ai-web/                    # Frontend Angular PWA
    ├── src/app/                           # Angular application source code
    │   ├── core/                          # Services, guards, configs, and API clients
    │   └── features/                      # Page components (workout-plan, onboarding, etc.)
    └── scripts/                           # Utility scripts (write-runtime-config, smoke checks)
```

---

## 3. Architecture Blueprint & Flows

### Authentication Flow
1. The user logs in via Clerk components in [physiocoach-ai-web](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-web).
2. The Angular app sends requests to [physiocoach-ai-api](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-api) with an `Authorization: Bearer <clerk_jwt>` header.
3. The Worker middleware validates the Clerk JWT (using JWKS keys) and populates the request context with the user info.

### AI Generation Flow
- When generating a workout plan (`POST /api/v1/workout-plans/generate`), the request is sent to the Cloudflare Worker.
- The Worker makes a server-side call to OpenRouter using the configured primary model (default: `google/gemma-4-26b-a4b-it:free`) and fallbacks (default: `openrouter/owl-alpha`).
- If the AI output fails schema validation, safety, or timeout checks, the Worker returns a structured, deterministic fallback workout plan to ensure resilience.

---

## 4. Local Development Setup

Follow these steps to initialize and run the project locally.

### Prerequisites
- Node.js >= 20.11.0
- pnpm >= 11.0.0
- Wrangler CLI (installed via dependencies)

### Step 4.1: API Backend Setup (`physiocoach-ai-api`)
Navigate to [physiocoach-ai-api](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-api):
```bash
cd physiocoach-ai-api
pnpm install
```

Copy the development environment template to `.dev.vars` (this is where Wrangler expects local secrets):
```bash
cp .env.dev .dev.vars
```

Initialize the local D1 database and apply migrations:
```bash
pnpm db:generate
pnpm db:migrate:local
```

Seed or import the exercise catalog (if needed for workout generation):
```bash
pnpm seed:exercise-catalog
```

Start the local API development server (runs on `http://localhost:8787`):
```bash
pnpm dev
```

### Step 4.2: Frontend Setup (`physiocoach-ai-web`)
Navigate to [physiocoach-ai-web](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-web):
```bash
cd physiocoach-ai-web
pnpm install
```

Copy the environment config file:
```bash
cp .env.example .env
```

Start the frontend development server (runs on `http://localhost:4200`):
```bash
pnpm dev
```

---

## 5. Development & Testing Commands

Before pushing any changes, you must validate your code.

### Backend Validation (`physiocoach-ai-api`)
- **Lint**: `pnpm lint`
- **Format Check**: `pnpm format:check` / `pnpm format` to write
- **Run Tests**: `pnpm test` (uses Vitest)
- **Comprehensive Validation**: `pnpm validate` (runs lint + tests + build)
- **Local DB Migrations**:
  - Generate migration: `pnpm db:generate`
  - Apply local: `pnpm db:migrate:local`
  - Apply dev: `pnpm db:migrate:dev`
  - Apply prod: `pnpm db:migrate:prod`

### Frontend Validation (`physiocoach-ai-web`)
- **Lint**: `pnpm lint`
- **Build**: `pnpm build`
- **Run Tests**: `pnpm test` (or `pnpm validate:core` to skip test suite if Rollup native bindings are blocked on your local machine)
- **Comprehensive Validation**: `pnpm validate`

### Generating the API Client
If you modify routes or OpenAPI specifications in the API, regenerate the Angular TypeScript client:
1. Ensure the local API is running (`pnpm dev` in `physiocoach-ai-api`).
2. Run in `physiocoach-ai-web`:
   ```bash
   API_OPENAPI_URL=http://localhost:8787/api/v1/openapi.json pnpm generate:api
   ```

### Smoke Checks
Verify deployments are functional:
- **API Dev Smoke**: `API_SMOKE_TOKEN=<jwt> pnpm smoke:api:dev`
- **API Prod Smoke**: `API_SMOKE_TOKEN=<jwt> pnpm smoke:api:prod`
- **Web Smoke**: `pnpm smoke:web:dev` / `pnpm smoke:web:prod`

---

## 6. Constraints & Guidelines for AI Agents

When implementing features, bug fixes, or modifying this codebase, you must adhere to the following rules:

1. **No Direct LLM Calls from Frontend**: Under no circumstances should the Angular code make calls directly to OpenRouter or other AI APIs. All AI prompts, models, configurations, and API keys must remain backend-only.
2. **Resilience & Fallbacks**: Any new AI-driven endpoint must validate the schema of the AI response and fallback gracefully to a safe, deterministic default structure if validation or connection fails.
3. **Environment Configurations**:
   - Do not edit `.dev.vars` or `.env` files directly in commits. Instead, edit [.env.dev.example](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-api/.env.dev.example) or [.env.example](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-web/.env.example) and let the pre-push Husky hooks sync them, or instruct the user to run sync commands.
4. **Database Safety**: Never modify migration SQL files manually. Always update the TypeScript schemas in [physiocoach-ai-api/src/db/schema.ts](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-api/src/db) and use `pnpm db:generate` to output new migrations.
5. **Code Style & Direct/Flat Architecture**:
   - Do not create `use-cases`, `repositories`, `domain-models`, or `interfaces` for simple operations. Keep the code flat.
   - All backend code must live strictly in:
     - `src/routes/` (for Hono endpoint logic)
     - `src/services/` (for heavier business workflows or external services)
     - `src/db/` (for Drizzle schemas and client initialization)
     - `src/middleware/` (for Hono middlewares)
     - `src/types/` (for TS/Zod schemas)
   - Execute database queries using Drizzle directly in route handlers. Do not wrap queries in abstraction repositories.
   - Do not create files containing only `export * from './...'`. Import directly from implementations.
   - Retain existing code organization and comments.
   - Use strict TypeScript checks.
   - Run formatting and linting prior to concluding any task.
