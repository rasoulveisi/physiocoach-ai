# PhysioCoach AI: Agent Customization Rules

These rules apply to any AI agent working within this workspace.

## 1. Project Initialization & Context
- Upon loading this workspace, you must read the detailed onboarding guide at [agent.md](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/agent.md).
- Understand that this is a full-stack project with an Angular PWA frontend ([physiocoach-ai-web](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-web)) and a Cloudflare Workers (Hono + D1) API backend ([physiocoach-ai-api](file:///Users/rasoul/rasoul/PhysioCoach%20Ai/physiocoach-ai-api)).

## 2. Technical Constraints
- **Zero Frontend AI Calls**: Never request, write, or suggest frontend calls directly to OpenRouter or other AI providers. All AI generation must go through the Cloudflare Worker API backend routes.
- **Fail-Safe AI Responses**: All AI endpoints in the backend must parse and validate inputs and outputs using strict Zod schemas and fallback to deterministic templates in case of AI timeouts, validation failures, or safety flags.
- **Database Schema & Migrations**: Do not write manual SQL migrations. Always edit the schema in `physiocoach-ai-api/src/db/schema.ts`, and run `pnpm db:generate` to produce the schema SQL migration.
- **API Client Synchronization**: When changing routes or schemas in the API, always regenerate the API client for the frontend. Make sure the API dev server is running on `http://localhost:8787` and then run:
  ```bash
  API_OPENAPI_URL=http://localhost:8787/api/v1/openapi.json pnpm generate:api
  ```
  in the `physiocoach-ai-web` directory.

## 3. Verification & Validation Rules
- Always run local validation before finishing work:
  - Backend: `pnpm validate` in `physiocoach-ai-api`
  - Frontend: `pnpm validate` or `pnpm validate:core` in `physiocoach-ai-web`
- Do not commit changes to `.env` or `.dev.vars` directly; update the `.example` or templates.

## 4. Simplified Coding Style & Architecture (Direct & Flat)
- **No DDD/Clean Architecture Layers**: Do not create or use `use-cases`, `repositories`, `domain-models`, or `interfaces` for simple operations. All code must belong strictly to:
  - `src/routes/` (for Hono endpoint logic)
  - `src/services/` (for heavier business workflows or external services)
  - `src/db/` (for Drizzle schemas and client initialization)
  - `src/middleware/` (for Hono middlewares)
  - `src/types/` (for TS/Zod schemas)
- **Direct Queries**: Execute database queries using Drizzle directly in route handlers. Do not wrap queries in abstraction repositories.
- **No Re-export Modules**: Do not create files containing only `export * from './...'`. Import directly from implementations.
- **Straightforward Logic**: Keep handlers readable, simple, and less buggy. Avoid over-engineering.

