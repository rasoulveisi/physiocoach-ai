# PhysioCoach AI: Agent Customization Rules

These rules apply to any AI agent working within this workspace.

## 1. Project Initialization & Context
- Upon loading this workspace, you must read the detailed onboarding guide at [agent.md](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/agent.md).
- Understand that this is a full-stack project with a React 19 PWA frontend ([physiocoach-ai-web](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web)) and a Cloudflare Workers (Express 5 + Drizzle ORM + Neon PostgreSQL via Hyperdrive) API backend ([physiocoach-ai-api](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-api)).

## 2. Technical & Environment Constraints (Production Database Policy)
- **Single Database Environment**: All environments connect to the Neon PostgreSQL database via Cloudflare Hyperdrive connection pooling.
- **Local Worker Execution**: Run the local backend with `npm run dev` in `physiocoach-ai-api` (executes `wrangler dev --config ./wrangler.jsonc --remote --port 8787`).
- **Zero Frontend AI Calls**: Never request, write, or suggest frontend calls directly to OpenRouter or other AI providers. All AI generation must go through the Cloudflare Worker API backend routes.
- **Medical Safety Standard & Zero Fallbacks**: Do not use hardcoded synthetic fallback workout plans or placeholder SVG images. Return traceable HTTP 409 error responses with `traceId` and `auditLogId`.
- **Database Schema & Migrations**: Do not write manual SQL migrations. Always edit the schema in `physiocoach-ai-api/src/db/schema.ts` and run `npm run db:generate`.

## 3. Verification & Validation Rules
- Always run local validation before finishing work:
  - Backend: `npm run validate` in `physiocoach-ai-api` (runs lint + vitest + typecheck)
  - Frontend: `npm run build` in `physiocoach-ai-web` (runs tsc + vite build)
- Do not commit changes to `.env` or `.dev.vars` directly; update the `.example` or templates.

## 4. Simplified Coding Style & Architecture (Direct & Flat)
- **Direct & Modular Structure**: All backend code must belong strictly to:
  - `src/routes/` (for Express route handlers and endpoint logic)
  - `src/services/` (for AI synthesis, safety checks, and external providers)
  - `src/db/` (for Drizzle schemas and client initialization)
  - `src/middleware/` (for Express middlewares: auth, error, trace)
  - `src/types/` (for TS/Zod contracts)
- **Direct Queries**: Execute database queries using Drizzle directly in route handlers and services. Do not wrap queries in over-engineered abstraction repositories.
- **No Re-export Modules**: Do not create files containing only `export * from './...'`. Import directly from implementations.
- **Straightforward Logic**: Keep handlers readable, simple, and strongly typed.
