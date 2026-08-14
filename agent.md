# PhysioCoach AI: Agent Onboarding & Project Guide

Welcome! This document is designed to onboard AI agents and developers to the **PhysioCoach AI** project. Read this document carefully upon workspace initialization to understand the project architecture, tech stack, directory structure, setup commands, and implementation constraints.

---

## 1. Project Overview & Environment Policy

**PhysioCoach AI** is an AI-powered physiotherapy and workout coaching platform split into two primary components:
1. **Frontend (`physiocoach-ai-web`)**: An Angular PWA, using PrimeNG and Tailwind CSS.
2. **Backend API (`physiocoach-ai-api`)**: A Hono REST API running on Cloudflare Workers, using Drizzle ORM to interface with Cloudflare D1.

### CRITICAL ENVIRONMENT POLICY (PRODUCTION D1 DATABASE ONLY)
- **Zero Local/Dev Database Instances**: There is **NO** local database instance, local SQLite state, or separate dev database environment. We have **ONLY** the production Cloudflare D1 database (`physiocoach_prod`).
- **Local Code + Production Database**: When running or developing the application on a local machine, application code executes locally while all database operations run directly against the production Cloudflare D1 database (`npx wrangler dev --config ./wrangler.toml --remote`).

### Core Stack
- **Database**: Cloudflare D1 (`physiocoach_prod`) + Drizzle ORM.
- **AI Generation**: OpenRouter server-side endpoint calls from Cloudflare Worker only. No client-side LLM calls are allowed.
- **Medical Standard Error Traceability**: No synthetic fallback workout plans or fake SVG/placeholder images are allowed. Failures return structured HTTP 409 errors with `traceId` and `auditLogId`.

---

## 2. Repository Structure

The project has a monorepo-style folder layout:

```
/Users/rasoul/rasoul/apps/PhysioCoach Ai/
├── docs/                                  # Global architecture documentation
├── physiocoach-ai-api/                    # Backend API (Cloudflare Worker)
│   ├── docs/                              # Catalog analysis and runbook docs
│   ├── src/                               # Application source code
│   │   ├── db/                            # Database schema and Drizzle migrations
│   │   ├── middleware/                    # Hono middlewares (auth, cors)
│   │   ├── routes/                        # Hono routes and API endpoints
│   │   ├── services/                      # Business workflows and AI provider logic
│   │   └── app.ts                         # App entry and route mounting
│   ├── tests/                             # Vitest behavior-driven integration tests
│   └── wrangler.toml                      # Wrangler Worker configuration
└── physiocoach-ai-web/                    # Frontend Angular PWA
    ├── src/app/                           # Angular application source code
    │   ├── core/                          # Services, guards, configs, and API clients
    │   └── features/                      # Page components (workout-plan, onboarding, etc.)
    └── scripts/                           # Utility scripts (write-runtime-config, smoke checks)
```

---

## 3. Architecture Blueprint & Flows

### Single Production Database Flow
- When running backend locally, execute:
  ```bash
  npx wrangler dev --config ./wrangler.toml --remote
  ```
- This binds your local worker code directly to the remote production D1 database (`physiocoach_prod`).

### AI Generation & Traceability
- Endpoint: `POST /api/v1/workout-plans/generate`.
- OpenRouter generates structured workout plans using production exercise catalog candidates (`candidateCount: 1324`).
- If AI generation fails, the backend logs audit entry to `ai_audit_logs` and returns HTTP 409 carrying `traceId`, `auditLogId`, and clinical error messages.

---

## 4. Development & Running Commands

### Running Backend API Locally (Connected to Production D1)
In `physiocoach-ai-api`:
```bash
npm run dev
# Executes: wrangler dev --config ./wrangler.toml --remote
```

### Running Frontend Locally
In `physiocoach-ai-web`:
```bash
npm run dev
# Executes: ng serve --port 4300
```

### API Client Synchronization
When modifying API routes or OpenAPI schemas, regenerate the Angular TypeScript client:
1. Ensure API dev server is running on `http://localhost:8787`.
2. Run in `physiocoach-ai-web`:
   ```bash
   API_OPENAPI_URL=http://localhost:8787/api/v1/openapi.json npm run generate:api
   ```

### Comprehensive Local Validation
- Backend API: `npm run validate` (runs lint + vitest + tsc --noEmit)
- Frontend: `npm run validate:core` (runs ng lint + ng build)

### Production Deployment
- Deploy API: `npm run deploy` in `physiocoach-ai-api` (executes `wrangler deploy --config ./wrangler.toml`)
- Git Push: `git add . && git commit -m "..." && git push`

---

## 5. Constraints & Guidelines for AI Agents

1. **Production Database Direct Access**: Do not generate or suggest local SQLite database files or separate dev databases. Always use `physiocoach_prod` D1 database.
2. **Zero Frontend AI Calls**: All AI generation must go through Cloudflare Worker API routes.
3. **Medical Safety Standard & Zero Fallbacks**: Never return synthetic fallback workout plans or placeholder images. Return traceable HTTP 409 errors with `traceId` and `auditLogId`.
4. **Database Schema & Migrations**: Edit schema in `physiocoach-ai-api/src/db/schema.ts`, run `npm run db:generate`, and apply remote migrations with `npm run db:migrate:remote`.
5. **Direct & Flat Architecture**: Keep code in `src/routes/`, `src/services/`, `src/db/`, `src/middleware/`, `src/types/`. No over-engineered repository/DDD abstractions.
