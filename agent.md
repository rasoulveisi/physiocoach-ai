# PhysioCoach AI: Agent Onboarding & Developer Guide

Welcome! This document is the definitive guide to the **PhysioCoach AI** codebase. Read this document to understand the project architecture, tech stack, directory structure, best practices, setup commands, and development guidelines.

---

## 1. Project Overview & Architecture

**PhysioCoach AI** is an AI-powered physiotherapy and athletic workout coaching platform built as a modern, decoupled full-stack application:

1. **Frontend (`physiocoach-ai-web`)**:
   - **Framework**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons.
   - **PWA Capabilities**: Installable Progressive Web App with custom Service Worker (`public/sw.js`), touch gesture swiping engine, locked `100dvh` mobile viewport, and responsive layout.
   - **State & Routing**: Context API (`AuthContext`, `PreferencesContext`, `ThemeContext`), React Router v7 (`createBrowserRouter`, `<ProtectedRoute />`, `<Outlet />`).

2. **Backend API (`physiocoach-ai-api`)**:
   - **Framework**: Express 5 on Node.js / Cloudflare Workers runtime via `nodejs_compat`.
   - **Database & ORM**: Neon PostgreSQL connected via Cloudflare Hyperdrive connection pooling + Drizzle ORM.
   - **AI Synthesis**: Server-side OpenRouter integration (`z-ai/glm-5.2:free` primary) with deterministic JSON schema validation and clinical safety contraindication checks.
   - **Authentication**: First-party password auth (PBKDF2 hashing) with rotating JWT refresh tokens and live Google OAuth OIDC integration.

---

## 2. Environment & Database Policy

### Single Production Database (Neon PostgreSQL via Cloudflare Hyperdrive)
- **Zero Local/Dev Database Instances**: There is **no** local SQLite or separate dev DB instance.
- **Local Worker Execution**: When developing locally, backend code runs on your local machine and connects to the remote Neon PostgreSQL instance via Cloudflare Hyperdrive / connection string (`npm run dev` in `physiocoach-ai-api`).
- **Zero Client-Side AI Calls**: The frontend never calls OpenRouter or LLMs directly. All AI generation is processed server-side through `/api/v1/workout-plans/generate`.
- **Medical Safety & Traceability**: No synthetic fake workouts or placeholder SVG images. Errors return structured HTTP 409 responses with `traceId` and `auditLogId`.

---

## 3. Monorepo Directory Structure

```
apps/PhysioCoach Ai/
├── physiocoach-ai-api/                    # Backend API (Express 5 / Cloudflare Worker)
│   ├── src/
│   │   ├── auth/                          # Password hashing, JWT signing, token rotation, sessions
│   │   ├── db/                            # Drizzle schemas (schema.ts), migrations, and DB client
│   │   ├── middleware/                    # Express middlewares (auth, cors, traceId, error handler)
│   │   ├── routes/                        # Express routers (auth, workout-plans, sessions, profiles, admin)
│   │   ├── services/                      # AI synthesis (OpenRouter), safety rules, exercise catalog
│   │   ├── shared/                        # Error classes, API responses, logging
│   │   ├── types/                         # Zod schemas and TypeScript interface definitions
│   │   ├── app.ts                         # Express app factory and middleware pipeline
│   │   └── index.ts                       # Cloudflare Worker entry point
│   ├── tests/                             # Vitest integration and behavior-driven test suite
│   ├── scripts/                           # Database seeding, catalog enrichment, smoke tests
│   └── wrangler.jsonc                     # Cloudflare Worker configuration & Hyperdrive bindings
│
├── physiocoach-ai-web/                    # Frontend Web App (React 19 PWA)
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/                        # Reusable UI library (Button, Modal, Card, HUD, Plate Calc)
│   │   ├── context/                       # React Context providers (AuthContext, Preferences, Theme)
│   │   ├── pages/                         # Page views (Dashboard, Plan, Session, Settings, Auth, Admin)
│   │   ├── services/                      # Frontend API client, audio cues, exercise swapper
│   │   ├── App.tsx                        # Main application layout with responsive navigation bars
│   │   ├── router.tsx                     # React Router v7 route definitions and route guards
│   │   └── main.tsx                       # React DOM root render and Service Worker registration
│   ├── public/                            # PWA manifest.json, sw.js, app icons, audio assets
│   ├── index.html                         # HTML5 root with responsive meta tags
│   └── vite.config.ts                     # Vite bundler configuration
│
├── docs/                                  # Global architecture specifications and blueprints
├── agent.md                               # This onboarding guide
└── README.md                              # Root repository README
```

---

## 4. Development Workflow & Commands

### 4.1 Backend API (`physiocoach-ai-api`)

```bash
cd physiocoach-ai-api

# Install dependencies
npm install

# Start local Express API server on port 8787
npm run dev

# Run Vitest test suite
npm test

# Run full validation (Linter + Vitest + Typecheck)
npm run validate

# Database Schema & Migrations
# 1. Edit schema in src/db/schema.ts
# 2. Generate migration files:
npm run db:generate
```

### 4.2 Frontend Web (`physiocoach-ai-web`)

```bash
cd physiocoach-ai-web

# Install dependencies
npm install

# Start Vite dev server at http://localhost:5173
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 5. Coding Style & Best Practices

### 5.1 Backend: Express 5 + Node.js Best Practices
1. **Pipeline Composition**: Compose Express middleware in logical order: CORS $\rightarrow$ JSON parsing $\rightarrow$ Request ID / Trace $\rightarrow$ Authentication $\rightarrow$ Route Handlers $\rightarrow$ Global Error Handler.
2. **Declaration Merging for Request Context**: Extend `Express.Request` interface in TypeScript for typed `req.user`, `req.traceId`, and `req.authSessionId`.
3. **Zod Validation**: Validate incoming payloads at route entry using Zod schemas (`z.object({...})`) and derive TypeScript types using `z.infer<typeof schema>`.
4. **Direct Drizzle Queries**: Keep database queries direct and clear without over-engineering abstract repository layers.
5. **Atomic Transactions**: Use Drizzle transactions (`db.transaction()`) when inserting related records (e.g., workout plan + workout days + exercises).
6. **Centralized Error Handling**: Throw domain errors (`ApiError`, `AuthError`) and catch them uniformly in the 4-argument Express error handler ([`src/middleware/error.ts`](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-api/src/middleware/error.ts)).

### 5.2 Frontend: React 19 Best Practices
1. **Functional Components & Hooks**: Use pure functional components with explicit TypeScript prop interfaces.
2. **Context for Global State**: Use React Context (`createContext` + custom hook `useAuth()`) for state that spans across views (Auth, Theme, User Preferences).
3. **Custom Hooks for Reusable Logic**: Extract asynchronous data fetching, timers, or window listeners into dedicated hooks.
4. **Tailwind CSS Utility Classes**: Use semantic Tailwind classes with `clsx` and `tailwind-merge` for conditional styling.
5. **Mobile-First UX**: Ensure zero horizontal overflow, locked mobile viewport (`100dvh`), and proper touch feedback for mobile users.

---

## 6. Pre-Commit / Pre-Finish Checklist

Before finishing any task:
1. **Backend Validation**: Run `npm run validate` in `physiocoach-ai-api` (must pass lint, unit tests, and typecheck).
2. **Frontend Validation**: Run `npm run build` in `physiocoach-ai-web` (must build cleanly with zero TypeScript or JSX errors).
3. **Traceability**: Ensure all API errors return consistent JSON `{ error, traceId, auditLogId? }`.
